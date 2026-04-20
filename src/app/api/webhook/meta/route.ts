import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig, setConfig } from '@/lib/config'
import { responderAgenteParaLead, encontrarAgentePorCanal } from '@/lib/agente/service'
import { marcarMensagemComoLida } from '@/lib/meta'
import { atualizarUltimaMsgUser } from '@/lib/wpp-leads'
import { transcreverAudioMeta } from '@/lib/transcribe'

async function saveDebug(etapa: string, detalhes: unknown) {
  try {
    const existing = (await getConfig('WEBHOOK_DEBUG_LOG')) || '[]'
    const arr = JSON.parse(existing) as unknown[]
    arr.push({ ts: new Date().toISOString(), etapa, detalhes })
    const last20 = arr.slice(-20)
    await setConfig('WEBHOOK_DEBUG_LOG', JSON.stringify(last20))
  } catch {}
}

async function isCoexistenciaMode(): Promise<boolean> {
  const mode = (await getConfig('WHATSAPP_MODE'))?.toLowerCase()
  return mode === 'coexistencia'
}

type MetaMessage = Record<string, unknown>

function extrairTextoMensagem(msg: MetaMessage): string | null {
  const type = msg.type as string | undefined

  if (type === 'text') {
    return ((msg.text as Record<string, unknown> | undefined)?.body as string | undefined) ?? null
  }
  if (type === 'button') {
    return ((msg.button as Record<string, unknown> | undefined)?.text as string | undefined) ?? null
  }
  if (type === 'interactive') {
    const interactive = msg.interactive as Record<string, unknown> | undefined
    const buttonReply = interactive?.button_reply as Record<string, unknown> | undefined
    const listReply = interactive?.list_reply as Record<string, unknown> | undefined
    return (buttonReply?.title as string | undefined) || (listReply?.title as string | undefined) || null
  }
  return null
}

function normalizarTelefone(raw: string): { full: string; short: string } {
  const digits = raw.replace(/\D/g, '')
  const full = digits.startsWith('55') ? digits : `55${digits}`
  const short = full.startsWith('55') ? full.slice(2) : full
  return { full, short }
}

// Gera variações com e sem o 9º dígito (números BR celular: DDD + 8 ou 9 dígitos)
function variacoesTelefone(raw: string): string[] {
  const { full, short } = normalizarTelefone(raw)
  const variações = new Set([full, short, raw])

  // short tem DDD (2 dígitos) + número local
  // Se número local tem 8 dígitos → adiciona variação com 9 na frente (sem 55 e com 55)
  // Se número local tem 9 dígitos → adiciona variação sem o 9 (sem 55 e com 55)
  if (short.length === 10) {
    // 2 DDD + 8 local → adiciona 9 após DDD
    const ddd = short.slice(0, 2)
    const local = short.slice(2)
    const com9 = `${ddd}9${local}`
    variações.add(com9)
    variações.add(`55${com9}`)
  } else if (short.length === 11) {
    // 2 DDD + 9 + 8 local → remove 9 após DDD
    const ddd = short.slice(0, 2)
    const local = short.slice(3) // pula o 9
    const sem9 = `${ddd}${local}`
    variações.add(sem9)
    variações.add(`55${sem9}`)
  }

  return Array.from(variações).filter(Boolean)
}

async function buscarInstanciaMetaPorPhoneId(
  phoneNumberId: string
): Promise<{ meta_access_token: string } | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('whatsapp_instancias')
    .select('meta_access_token')
    .eq('tipo', 'meta')
    .eq('meta_phone_number_id', phoneNumberId)
    .eq('ativo', true)
    .single()
  return data ?? null
}

async function buscarLeadPorTelefone(raw: string): Promise<{ id: string } | null> {
  const supabase = createAdminClient()
  const tentativas = variacoesTelefone(raw)

  for (const t of tentativas) {
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('whatsapp', t)
      .maybeSingle()
    if (data) return data
  }

  // Fallback por ILIKE com os dois formatos principais
  const { full, short } = normalizarTelefone(raw)
  const { data: fallback } = await supabase
    .from('leads')
    .select('id')
    .or(`whatsapp.ilike.%${short}%,whatsapp.ilike.%${full}%`)
    .limit(1)
    .maybeSingle()
  return fallback ?? null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = (await getConfig('META_VERIFY_TOKEN')) || process.env.META_VERIFY_TOKEN

  console.log('[webhook/meta] GET verify — mode:', mode, 'token match:', token === verifyToken, 'verifyToken set:', !!verifyToken)

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden', debug: { mode, tokenReceived: !!token, verifyTokenSet: !!verifyToken } }, { status: 403 })
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }

  await saveDebug('webhook_recebido', body)

  try {
    const entry = (body as Record<string, unknown>)?.entry as Record<string, unknown>[] | undefined
    const changes = entry?.[0]?.changes as Record<string, unknown>[] | undefined
    const value = changes?.[0]?.value as Record<string, unknown> | undefined

    if (!value) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const phoneNumberId = value.metadata
      ? (value.metadata as Record<string, string>).phone_number_id
      : undefined

    const coexistencia = await isCoexistenciaMode()
    const maestriaPhoneId = await getConfig('META_PHONE_NUMBER_ID')
    const forwardUrl = await getConfig('META_FORWARD_WEBHOOK_URL')

    // Em modo coexistência, processa tudo. Fora dele, aceita o número principal
    // OU qualquer instância registrada em whatsapp_instancias.
    let accessTokenInstancia: string | null = null
    if (!coexistencia && phoneNumberId) {
      const ehPrincipal = !maestriaPhoneId || phoneNumberId === maestriaPhoneId
      if (!ehPrincipal) {
        const instancia = await buscarInstanciaMetaPorPhoneId(phoneNumberId)
        if (!instancia) {
          // Número desconhecido — encaminha se configurado e ignora
          await saveDebug('forward_outro_numero', { phoneNumberId, forwardUrl })
          if (forwardUrl) {
            try {
              const res = await fetch(forwardUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })
              await saveDebug('forward_resultado', { status: res.status, ok: res.ok })
            } catch (err) {
              await saveDebug('forward_erro', { erro: String(err) })
            }
          }
          return NextResponse.json({ status: 'ok' }, { status: 200 })
        }
        // Número secundário registrado — usa o token dele para marcar como lida
        accessTokenInstancia = instancia.meta_access_token
      }
    }

    const messages = value.messages as MetaMessage[] | undefined
    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const message = messages[0]
    const from = message.from as string | undefined
    const messageId = message.id as string | undefined
    const messageType = message.type as string | undefined

    let texto = extrairTextoMensagem(message)

    // Transcreve áudio/voz via Whisper quando não há texto
    if (!texto && (messageType === 'audio' || messageType === 'voice')) {
      const audioId = (message.audio as Record<string, unknown> | undefined)?.id as string | undefined
      const accessToken = await getConfig('META_ACCESS_TOKEN')
      if (audioId && accessToken) {
        await saveDebug('transcricao_audio', { audioId })
        texto = await transcreverAudioMeta(audioId, accessToken)
        if (texto) await saveDebug('transcricao_ok', { texto })
      }
    }

    if (!from || !texto) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // Marca como lida — usa credenciais da instância secundária se for o caso
    if (!coexistencia && messageId) {
      const credLida = accessTokenInstancia && phoneNumberId
        ? { phoneNumberId, accessToken: accessTokenInstancia }
        : undefined
      marcarMensagemComoLida(messageId, credLida).catch((err) =>
        console.error('[webhook/meta] erro ao marcar lida:', err)
      )
    }

    // Atualiza timestamp de última mensagem recebida (janela 24h)
    atualizarUltimaMsgUser(from).catch(err =>
      console.error('[webhook/meta] erro ao atualizar ultima_msg_user:', err)
    )

    // ── Debounce: acumula mensagens picadas e aguarda o lead terminar ──────────
    const DEBOUNCE_META_MS = 5000 // 5 segundos sem nova mensagem → responde
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const chegouEm = new Date().toISOString()

    // 1. Salva mensagem na fila
    await supabase.from('mensagens_fila_meta').insert({
      phone: from,
      texto,
      message_id: messageId,
      criado_em: chegouEm,
    })

    // 2. Aguarda a janela de debounce
    await new Promise(r => setTimeout(r, DEBOUNCE_META_MS))

    // 3. Verifica se chegou mensagem mais nova do mesmo lead durante a espera
    const { data: maisNova } = await supabase
      .from('mensagens_fila_meta')
      .select('id')
      .eq('phone', from)
      .gt('criado_em', chegouEm)
      .limit(1)
      .maybeSingle()

    if (maisNova) {
      // Outra mensagem mais recente vai processar tudo — esta pode sair
      await saveDebug('debounce_meta_skip', { from, motivo: 'mensagem mais nova aguardando' })
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // 4. Esta é a mensagem mais recente — coleta todas da fila deste lead
    const { data: fila } = await supabase
      .from('mensagens_fila_meta')
      .select('texto, message_id')
      .eq('phone', from)
      .order('criado_em', { ascending: true })

    // 5. Limpa a fila deste lead
    await supabase.from('mensagens_fila_meta').delete().eq('phone', from)

    const textoFinal = (fila ?? []).map((m: { texto: string }) => m.texto).join('\n')
    const msgIdFinal = messageId

    if (!textoFinal) return NextResponse.json({ status: 'ok' }, { status: 200 })

    const msgCount = (fila ?? []).length
    if (msgCount > 1) await saveDebug('debounce_meta_agrupou', { from, total: msgCount, textoFinal })

    const lead = await buscarLeadPorTelefone(from)
    if (!lead) {
      await saveDebug('lead_nao_encontrado', { from, texto: textoFinal })
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    await saveDebug('disparando_agente', { leadId: lead.id, texto: textoFinal })
    try {
      const agente = await encontrarAgentePorCanal('meta')
      const result = await responderAgenteParaLead(lead.id, textoFinal, true, { provider: 'meta' }, agente, msgIdFinal)
      await saveDebug('agente_respondeu', { leadId: lead.id, resposta: result.resposta })
    } catch (agenteErr) {
      await saveDebug('agente_erro', { leadId: lead.id, erro: String(agenteErr) })
      throw agenteErr
    }
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/webhook/meta]', err)
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }
}

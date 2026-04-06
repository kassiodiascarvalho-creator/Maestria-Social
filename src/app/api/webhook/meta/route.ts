import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig, setConfig } from '@/lib/config'
import { responderAgenteParaLead } from '@/lib/agente/service'
import { marcarMensagemComoLida } from '@/lib/meta'

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

async function buscarLeadPorTelefone(raw: string): Promise<{ id: string } | null> {
  const supabase = createAdminClient()
  const { full, short } = normalizarTelefone(raw)

  const tentativas = [full, short, raw].filter(Boolean)
  for (const t of tentativas) {
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('whatsapp', t)
      .maybeSingle()
    if (data) return data
  }

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

    // Em modo coexistência, ignora a verificação de phone_number_id — a mensagem
    // pode vir encaminhada por outra plataforma com um ID diferente.
    if (!coexistencia && phoneNumberId && maestriaPhoneId && phoneNumberId !== maestriaPhoneId) {
      if (forwardUrl) {
        fetch(forwardUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch((err) => console.error('[webhook/meta] Erro ao encaminhar:', err))
      }
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const messages = value.messages as MetaMessage[] | undefined
    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const message = messages[0]
    const from = message.from as string | undefined
    const texto = extrairTextoMensagem(message)
    const messageId = message.id as string | undefined

    if (!from || !texto) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // Marca como lida apenas no modo Meta (coexistência não acessa Meta API diretamente)
    if (!coexistencia && messageId) {
      marcarMensagemComoLida(messageId).catch((err) =>
        console.error('[webhook/meta] erro ao marcar lida:', err)
      )
    }

    const lead = await buscarLeadPorTelefone(from)
    if (!lead) {
      await saveDebug('lead_nao_encontrado', { from, texto })
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    await saveDebug('disparando_agente', { leadId: lead.id, texto })
    try {
      const result = await responderAgenteParaLead(lead.id, texto, true)
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

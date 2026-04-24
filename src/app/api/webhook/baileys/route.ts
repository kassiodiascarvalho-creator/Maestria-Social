import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig, setConfig } from '@/lib/config'
import { responderAgenteParaLead, encontrarAgentePorCanal } from '@/lib/agente/service'
import { atualizarUltimaMsgUser } from '@/lib/wpp-leads'

export const dynamic = 'force-dynamic'

async function saveDebug(etapa: string, detalhes: unknown) {
  try {
    const existing = (await getConfig('BAILEYS_WEBHOOK_DEBUG')) || '[]'
    const arr = JSON.parse(existing) as unknown[]
    arr.push({ ts: new Date().toISOString(), etapa, detalhes })
    await setConfig('BAILEYS_WEBHOOK_DEBUG', JSON.stringify(arr.slice(-30)))
  } catch {}
}

// Normaliza JID do WhatsApp para número de telefone puro.
// @s.whatsapp.net / @c.us → baseados em telefone, pode extrair.
// @lid → ID interno multi-device, NÃO é telefone, retorna null.
// @g.us → grupo, ignora.
function extrairTelefoneDeJID(raw: string): string | null {
  if (raw.includes('@s.whatsapp.net') || raw.includes('@c.us')) {
    return raw.split('@')[0]
  }
  if (raw.includes('@')) return null // @lid, @g.us ou outro JID não resolvível
  return raw
}

function normalizarTelefone(raw: string): { full: string; short: string } {
  const digits = raw.replace(/\D/g, '')
  const full = digits.startsWith('55') ? digits : `55${digits}`
  const short = full.startsWith('55') ? full.slice(2) : full
  return { full, short }
}

function variacoesTelefone(raw: string): string[] {
  const { full, short } = normalizarTelefone(raw)
  const vars = new Set([full, short, raw])
  if (short.length === 10) {
    const ddd = short.slice(0, 2)
    const local = short.slice(2)
    const com9 = `${ddd}9${local}`
    vars.add(com9)
    vars.add(`55${com9}`)
  } else if (short.length === 11) {
    const ddd = short.slice(0, 2)
    const local = short.slice(3)
    const sem9 = `${ddd}${local}`
    vars.add(sem9)
    vars.add(`55${sem9}`)
  }
  return Array.from(vars).filter(Boolean)
}

async function buscarLeadPorTelefone(raw: string) {
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
  const { full, short } = normalizarTelefone(raw)
  const { data } = await supabase
    .from('leads')
    .select('id')
    .or(`whatsapp.ilike.%${short}%,whatsapp.ilike.%${full}%`)
    .limit(1)
    .maybeSingle()
  if (data) return data

  // Fallback: busca via wpp_contatos.lead_id (vínculo criado na sincronização do disparo)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: contato } = await db
    .from('wpp_contatos')
    .select('lead_id')
    .not('lead_id', 'is', null)
    .or(`telefone.eq.${raw},telefone.eq.${full},telefone.eq.${short}`)
    .limit(1)
    .maybeSingle()
  if (contato?.lead_id) return { id: contato.lead_id as string }

  return null
}

export async function POST(req: NextRequest) {
  // Autenticação via secret compartilhado
  const secret = await getConfig('AGENT_BAILEYS_SECRET')
  if (secret) {
    const headerSecret = req.headers.get('x-baileys-secret')
    if (headerSecret !== secret) {
      await saveDebug('auth_falhou', { headerSecret: headerSecret?.slice(0, 8) })
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  }

  let body: { instanceId?: string; phone?: string; texto?: string; messageId?: string }
  try {
    body = await req.json()
  } catch {
    await saveDebug('body_invalido', {})
    return NextResponse.json({ status: 'ok' })
  }

  const { instanceId, phone, texto, messageId } = body
  await saveDebug('recebido', { instanceId, phone, texto: texto?.slice(0, 50), messageId })

  if (!phone || !texto || !instanceId) {
    await saveDebug('campos_faltando', { phone: !!phone, texto: !!texto, instanceId: !!instanceId })
    return NextResponse.json({ status: 'ok' })
  }

  try {
    // Resolve JID para telefone real antes de buscar o lead
    const phoneParsed = extrairTelefoneDeJID(phone)
    if (!phoneParsed) {
      await saveDebug('jid_nao_resolvivel', {
        phone,
        instrucao: 'O servidor Baileys está enviando @lid em vez do número real. Configure-o para enviar o telefone (ex: 5511999999999) ou o JID @s.whatsapp.net.',
      })
      return NextResponse.json({ status: 'ok' })
    }
    const phoneReal = phoneParsed

    atualizarUltimaMsgUser(phoneReal).catch(() => {})

    const lead = await buscarLeadPorTelefone(phoneReal)
    if (!lead) {
      await saveDebug('lead_nao_encontrado', { phone: phoneReal, phoneOriginal: phone })
      return NextResponse.json({ status: 'ok' })
    }

    const agente = await encontrarAgentePorCanal('baileys', instanceId)
    if (!agente) {
      await saveDebug('agente_nao_encontrado', { instanceId })
      return NextResponse.json({ status: 'ok' })
    }

    await saveDebug('processando', { leadId: lead.id, agenteId: agente.id, instanceId, phone: phoneReal })
    await responderAgenteParaLead(lead.id, texto, true, { provider: 'baileys', instanceId }, agente, messageId)
    await saveDebug('respondeu', { leadId: lead.id, phone: phoneReal })
  } catch (err) {
    await saveDebug('erro', { msg: String(err) })
    console.error('[webhook/baileys]', err)
  }

  return NextResponse.json({ status: 'ok' })
}
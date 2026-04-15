import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'
import { responderAgenteParaLead, encontrarAgentePorCanal } from '@/lib/agente/service'
import { atualizarUltimaMsgUser } from '@/lib/wpp-leads'

export const dynamic = 'force-dynamic'

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
  return data ?? null
}

export async function POST(req: NextRequest) {
  // Autenticação via secret compartilhado
  const secret = await getConfig('AGENT_BAILEYS_SECRET')
  if (secret) {
    const headerSecret = req.headers.get('x-baileys-secret')
    if (headerSecret !== secret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  }

  let body: { instanceId?: string; phone?: string; texto?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ status: 'ok' })
  }

  const { instanceId, phone, texto } = body
  if (!phone || !texto || !instanceId) {
    return NextResponse.json({ status: 'ok' })
  }

  try {
    atualizarUltimaMsgUser(phone).catch(() => {})

    const lead = await buscarLeadPorTelefone(phone)
    if (!lead) return NextResponse.json({ status: 'ok' })

    const agente = await encontrarAgentePorCanal('baileys', instanceId)
    await responderAgenteParaLead(lead.id, texto, true, { provider: 'baileys', instanceId }, agente)
  } catch (err) {
    console.error('[webhook/baileys]', err)
  }

  return NextResponse.json({ status: 'ok' })
}
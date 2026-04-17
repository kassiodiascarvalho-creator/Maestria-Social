import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const etiqueta = searchParams.get('etiqueta') || ''
  const q = searchParams.get('q') || ''

  const supabase = createAdminClient()

  // 1. Busca as últimas mensagens de cada lead (limit 500 mensagens recentes)
  const { data: msgs, error: msgsError } = await supabase
    .from('conversas')
    .select('lead_id, mensagem, role, criado_em')
    .order('criado_em', { ascending: false })
    .limit(500)

  if (msgsError) return NextResponse.json({ error: msgsError.message }, { status: 500 })

  // 2. Deduplica por lead_id — mantém apenas a última mensagem de cada lead
  const ultimasMsgs: Record<string, { mensagem: string; role: string; criado_em: string }> = {}
  for (const msg of msgs || []) {
    if (!ultimasMsgs[msg.lead_id]) {
      ultimasMsgs[msg.lead_id] = { mensagem: msg.mensagem, role: msg.role, criado_em: msg.criado_em }
    }
  }

  const leadIds = Object.keys(ultimasMsgs)
  if (leadIds.length === 0) return NextResponse.json([])

  // 3. Busca dados dos leads (com filtros opcionais)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let leadsQuery = (supabase as any)
    .from('leads')
    .select('id, nome, whatsapp, etiqueta, status_lead')
    .in('id', leadIds)

  if (etiqueta) leadsQuery = leadsQuery.eq('etiqueta', etiqueta)
  if (q) leadsQuery = leadsQuery.or(`nome.ilike.%${q}%,whatsapp.ilike.%${q}%`)

  const { data: leads, error: leadsError } = await leadsQuery
  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

  // 4. Combina e ordena por atividade mais recente
  const result = (leads || [])
    .map((l: Record<string, unknown>) => ({
      ...l,
      ultima_mensagem: ultimasMsgs[l.id as string]?.mensagem ?? '',
      ultima_role: ultimasMsgs[l.id as string]?.role ?? 'user',
      ultima_atividade: ultimasMsgs[l.id as string]?.criado_em ?? '',
    }))
    .sort((a: Record<string, string>, b: Record<string, string>) =>
      (b.ultima_atividade || '').localeCompare(a.ultima_atividade || '')
    )

  return NextResponse.json(result)
}

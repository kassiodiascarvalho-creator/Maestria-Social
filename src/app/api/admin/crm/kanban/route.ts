import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()

  const [leadsRes, msgsRes, qualsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('leads')
      .select('id, nome, email, whatsapp, qs_total, nivel_qs, pilar_fraco, scores, status_lead, etiqueta, pipeline_etapa, origem, criado_em, notas_crm, agente_id')
      .order('criado_em', { ascending: false })
      .limit(500),
    supabase
      .from('conversas')
      .select('lead_id, mensagem, role, criado_em')
      .order('criado_em', { ascending: false })
      .limit(1000),
    supabase
      .from('qualificacoes')
      .select('lead_id'),
  ])

  const leads = leadsRes.data ?? []
  if (leads.length === 0) return NextResponse.json([])

  const ultimasMsgs: Record<string, { mensagem: string; role: string; criado_em: string }> = {}
  for (const msg of msgsRes.data ?? []) {
    if (!ultimasMsgs[msg.lead_id]) {
      ultimasMsgs[msg.lead_id] = { mensagem: msg.mensagem, role: msg.role, criado_em: msg.criado_em }
    }
  }

  const qualCount: Record<string, number> = {}
  for (const q of qualsRes.data ?? []) {
    qualCount[q.lead_id] = (qualCount[q.lead_id] || 0) + 1
  }

  const result = leads.map((l: Record<string, unknown>) => ({
    ...l,
    ultima_mensagem: ultimasMsgs[l.id as string]?.mensagem ?? '',
    ultima_role: ultimasMsgs[l.id as string]?.role ?? 'user',
    ultima_atividade: ultimasMsgs[l.id as string]?.criado_em ?? l.criado_em,
    num_qualificacoes: qualCount[l.id as string] || 0,
  }))

  return NextResponse.json(result)
}

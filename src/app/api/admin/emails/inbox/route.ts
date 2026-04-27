import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const status = req.nextUrl.searchParams.get('status') || ''

  let q = db
    .from('conversas_email')
    .select('*')
    .order('ultima_mensagem_em', { ascending: false })
    .limit(200)

  if (status) q = q.eq('status', status)

  const { data, error } = await q

  if (error) {
    const semTabela = error.message?.includes('does not exist') || error.code === '42P01'
    if (semTabela) return NextResponse.json({ error: 'SETUP_NEEDED', conversas: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enriquecer com nome do lead e campanha via queries separadas (sem depender de FK)
  const conversas = data || []

  const leadIds    = [...new Set(conversas.map((c: any) => c.lead_id).filter(Boolean))]
  const campIds    = [...new Set(conversas.map((c: any) => c.campanha_id).filter(Boolean))]

  const [leadsRes, campsRes] = await Promise.all([
    leadIds.length ? db.from('leads').select('id,nome,telefone').in('id', leadIds) : { data: [] },
    campIds.length ? db.from('email_campanhas').select('id,nome').in('id', campIds) : { data: [] },
  ])

  const leadsMap: Record<string, { nome: string; telefone: string }> = {}
  for (const l of leadsRes.data ?? []) leadsMap[l.id] = l

  const campsMap: Record<string, { nome: string }> = {}
  for (const c of campsRes.data ?? []) campsMap[c.id] = c

  const conversasEnriquecidas = conversas.map((c: any) => ({
    ...c,
    leads:           c.lead_id    ? leadsMap[c.lead_id]    ?? null : null,
    email_campanhas: c.campanha_id ? campsMap[c.campanha_id] ?? null : null,
  }))

  // Estatísticas de resposta (sobre total sem filtro)
  const total       = conversas.length
  const respondidas = conversas.filter((c: any) => c.status === 'respondido').length
  const taxaResposta = total > 0 ? ((respondidas / total) * 100).toFixed(1) : '0'

  return NextResponse.json({ conversas: conversasEnriquecidas, stats: { total, respondidas, taxaResposta } })
}

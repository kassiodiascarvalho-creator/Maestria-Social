import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { searchParams } = new URL(req.url)
  const campanha_id = searchParams.get('campanha_id')

  if (campanha_id) {
    // Métricas detalhadas de uma campanha
    const { data: campanha } = await db.from('email_campanhas').select('*').eq('id', campanha_id).single()
    const { data: logs } = await db.from('email_logs')
      .select('status, variante, enviado_em, aberto_em, clicado_em')
      .eq('campanha_id', campanha_id)

    if (!campanha || !logs) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const total = logs.length
    const entregues = logs.filter((l: any) => ['entregue','aberto','clicado'].includes(l.status)).length
    const abertos = logs.filter((l: any) => ['aberto','clicado'].includes(l.status)).length
    const clicados = logs.filter((l: any) => l.status === 'clicado').length
    const bounced = logs.filter((l: any) => l.status === 'bounced').length
    const spam = logs.filter((l: any) => l.status === 'spam').length

    const taxaAbertura = entregues > 0 ? ((abertos / entregues) * 100).toFixed(1) : '0'
    const ctr = entregues > 0 ? ((clicados / entregues) * 100).toFixed(1) : '0'
    const ctor = abertos > 0 ? ((clicados / abertos) * 100).toFixed(1) : '0'

    // A/B breakdown
    const varA = logs.filter((l: any) => l.variante === 'a')
    const varB = logs.filter((l: any) => l.variante === 'b')
    const abResume = campanha.ab_ativo ? {
      a: { total: varA.length, abertos: varA.filter((l: any) => ['aberto','clicado'].includes(l.status)).length },
      b: { total: varB.length, abertos: varB.filter((l: any) => ['aberto','clicado'].includes(l.status)).length },
    } : null

    return NextResponse.json({ campanha, metricas: { total, entregues, abertos, clicados, bounced, spam, taxaAbertura, ctr, ctor }, ab: abResume })
  }

  // Métricas gerais (últimos 30 dias)
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: campanhas } = await db.from('email_campanhas')
    .select('id, nome, status, total_enviados, total_abertos, total_cliques, total_bounced, concluido_em')
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })

  const totais = (campanhas ?? []).reduce((acc: any, c: any) => ({
    enviados: acc.enviados + (c.total_enviados || 0),
    abertos: acc.abertos + (c.total_abertos || 0),
    cliques: acc.cliques + (c.total_cliques || 0),
    bounced: acc.bounced + (c.total_bounced || 0),
  }), { enviados: 0, abertos: 0, cliques: 0, bounced: 0 })

  const taxaAbertura = totais.enviados > 0 ? ((totais.abertos / totais.enviados) * 100).toFixed(1) : '0'
  const ctr = totais.enviados > 0 ? ((totais.cliques / totais.enviados) * 100).toFixed(1) : '0'

  return NextResponse.json({ campanhas: campanhas ?? [], totais, taxaAbertura, ctr })
}

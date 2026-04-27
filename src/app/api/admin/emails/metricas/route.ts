import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Status considerados "entregues" — inclui 'enviando' pois não temos webhook de entrega do Resend
const ENTREGUES = ['enviando', 'entregue', 'aberto', 'clicado']
const ABERTOS   = ['aberto', 'clicado']

export async function GET(req: NextRequest) {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { searchParams } = new URL(req.url)
  const campanha_id = searchParams.get('campanha_id')

  if (campanha_id) {
    // Métricas detalhadas de uma campanha — sempre lê dos logs reais
    const [{ data: campanha }, { data: logs }] = await Promise.all([
      db.from('email_campanhas').select('*').eq('id', campanha_id).single(),
      db.from('email_logs')
        .select('id, status, variante, email, nome, enviado_em, aberto_em, clicado_em, total_aberturas, total_cliques')
        .eq('campanha_id', campanha_id)
        .order('enviado_em', { ascending: false }),
    ])

    if (!campanha || !logs) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const total    = logs.length
    const entregues = logs.filter((l: any) => ENTREGUES.includes(l.status)).length
    const abertos   = logs.filter((l: any) => ABERTOS.includes(l.status)).length
    const clicados  = logs.filter((l: any) => l.status === 'clicado').length
    const bounced   = logs.filter((l: any) => l.status === 'bounced').length
    const spam      = logs.filter((l: any) => l.status === 'spam').length
    const unsub     = logs.filter((l: any) => l.status === 'cancelado').length

    const taxaAbertura = entregues > 0 ? ((abertos  / entregues) * 100).toFixed(1) : '0'
    const ctr          = entregues > 0 ? ((clicados / entregues) * 100).toFixed(1) : '0'
    const ctor         = abertos   > 0 ? ((clicados / abertos)   * 100).toFixed(1) : '0'

    // A/B breakdown
    const varA = logs.filter((l: any) => l.variante === 'a')
    const varB = logs.filter((l: any) => l.variante === 'b')
    const ab = campanha.ab_ativo ? {
      a: { total: varA.length, abertos: varA.filter((l: any) => ABERTOS.includes(l.status)).length },
      b: { total: varB.length, abertos: varB.filter((l: any) => ABERTOS.includes(l.status)).length },
    } : null

    // Lista dos 20 últimos que abriram ou clicaram
    const engajados = logs
      .filter((l: any) => ABERTOS.includes(l.status))
      .slice(0, 20)
      .map((l: any) => ({ id: l.id, email: l.email, nome: l.nome, status: l.status, aberto_em: l.aberto_em, clicado_em: l.clicado_em }))

    return NextResponse.json({
      campanha,
      metricas: { total, entregues, abertos, clicados, bounced, spam, unsub, taxaAbertura, ctr, ctor },
      ab,
      engajados,
    })
  }

  // Métricas gerais (últimos 30 dias) — agrega diretamente dos logs para precisão
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: campanhas } = await db.from('email_campanhas')
    .select('id, nome, status, total_enviados, total_abertos, total_cliques, total_bounced, concluido_em')
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })

  // Para campanhas enviadas recalcula dos logs (evita contadores obsoletos)
  const ids = (campanhas ?? []).filter((c: any) => c.status === 'enviado').map((c: any) => c.id)
  let logAgg: Record<string, { abertos: number; clicados: number }> = {}

  if (ids.length > 0) {
    const { data: allLogs } = await db.from('email_logs')
      .select('campanha_id, status')
      .in('campanha_id', ids)
    for (const l of allLogs ?? []) {
      if (!logAgg[l.campanha_id]) logAgg[l.campanha_id] = { abertos: 0, clicados: 0 }
      if (ABERTOS.includes(l.status))    logAgg[l.campanha_id].abertos++
      if (l.status === 'clicado')        logAgg[l.campanha_id].clicados++
    }
  }

  // Mescla contadores reais nos objetos de campanha
  const campanhasComLive = (campanhas ?? []).map((c: any) => ({
    ...c,
    total_abertos: logAgg[c.id]?.abertos ?? c.total_abertos ?? 0,
    total_cliques: logAgg[c.id]?.clicados ?? c.total_cliques ?? 0,
  }))

  const totais = campanhasComLive.reduce((acc: any, c: any) => ({
    enviados: acc.enviados + (c.total_enviados || 0),
    abertos:  acc.abertos  + (c.total_abertos  || 0),
    cliques:  acc.cliques  + (c.total_cliques  || 0),
    bounced:  acc.bounced  + (c.total_bounced  || 0),
  }), { enviados: 0, abertos: 0, cliques: 0, bounced: 0 })

  const taxaAbertura = totais.enviados > 0 ? ((totais.abertos / totais.enviados) * 100).toFixed(1) : '0'
  const ctr          = totais.enviados > 0 ? ((totais.cliques / totais.enviados) * 100).toFixed(1) : '0'

  return NextResponse.json({ campanhas: campanhasComLive, totais, taxaAbertura, ctr })
}

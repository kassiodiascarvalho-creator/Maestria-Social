import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo') || '30' // dias
  const desde = new Date(Date.now() - Number(periodo) * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: vendas }, { data: hoje }] = await Promise.all([
    db.from('vendas').select('*').gte('criado_em', desde).order('criado_em', { ascending: false }),
    db.from('vendas').select('*').gte('criado_em', new Date(new Date().setHours(0,0,0,0)).toISOString()).eq('status', 'aprovado'),
  ])

  const aprovadas = (vendas ?? []).filter((v: any) => v.status === 'aprovado') // eslint-disable-line @typescript-eslint/no-explicit-any

  const totais = {
    vendas: aprovadas.length,
    receita: aprovadas.reduce((s: number, v: any) => s + Number(v.valor || 0), 0), // eslint-disable-line @typescript-eslint/no-explicit-any
    ticket_medio: aprovadas.length > 0 ? aprovadas.reduce((s: number, v: any) => s + Number(v.valor || 0), 0) / aprovadas.length : 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    canceladas: (vendas ?? []).filter((v: any) => v.status === 'cancelado').length, // eslint-disable-line @typescript-eslint/no-explicit-any
    reembolsadas: (vendas ?? []).filter((v: any) => v.status === 'reembolsado').length, // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  // Receita hoje
  const receitaHoje = (hoje ?? []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0) // eslint-disable-line @typescript-eslint/no-explicit-any

  // Por plataforma
  const porPlataforma: Record<string, { vendas: number; receita: number }> = {}
  for (const v of aprovadas) {
    if (!porPlataforma[v.plataforma]) porPlataforma[v.plataforma] = { vendas: 0, receita: 0 }
    porPlataforma[v.plataforma].vendas++
    porPlataforma[v.plataforma].receita += Number(v.valor || 0)
  }

  // Por produto
  const porProduto: Record<string, { vendas: number; receita: number }> = {}
  for (const v of aprovadas) {
    const nome = v.produto_nome || 'Sem nome'
    if (!porProduto[nome]) porProduto[nome] = { vendas: 0, receita: 0 }
    porProduto[nome].vendas++
    porProduto[nome].receita += Number(v.valor || 0)
  }

  // Por UTM source
  const porFonte: Record<string, number> = {}
  for (const v of aprovadas) {
    const src = v.utm_source || 'direto'
    porFonte[src] = (porFonte[src] || 0) + 1
  }

  // Evolução diária (últimos N dias)
  const porDia: Record<string, { vendas: number; receita: number }> = {}
  for (const v of aprovadas) {
    const dia = v.criado_em?.slice(0, 10)
    if (!dia) continue
    if (!porDia[dia]) porDia[dia] = { vendas: 0, receita: 0 }
    porDia[dia].vendas++
    porDia[dia].receita += Number(v.valor || 0)
  }

  return NextResponse.json({
    vendas: vendas ?? [],
    totais,
    receitaHoje,
    porPlataforma,
    porProduto: Object.entries(porProduto).sort((a, b) => b[1].receita - a[1].receita).slice(0, 10),
    porFonte: Object.entries(porFonte).sort((a, b) => b[1] - a[1]),
    porDia: Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0])),
  })
}

export async function POST(req: NextRequest) {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const body = await req.json()
  const { processarCompra } = await import('@/lib/vendas')
  const result = await processarCompra({ plataforma: 'manual', ...body })
  return NextResponse.json(result, { status: 201 })
}

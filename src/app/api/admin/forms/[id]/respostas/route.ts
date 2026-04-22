import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const { searchParams } = new URL(req.url)
  const limite = Math.min(parseInt(searchParams.get('limite') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const apenasAbandonados = searchParams.get('abandonados') === '1'
  const responseId = searchParams.get('response_id') // detalhe de uma resposta específica

  // Detalhe de uma resposta específica (todas as perguntas + respostas)
  if (responseId) {
    const { data: perguntas } = await db
      .from('form_questions')
      .select('id, tipo, label, ordem')
      .eq('form_id', id)
      .order('ordem')

    const { data: answers } = await db
      .from('form_answers')
      .select('question_id, valor')
      .eq('response_id', responseId)

    const answerMap: Record<string, string> = {}
    for (const a of answers ?? []) answerMap[a.question_id] = a.valor

    const detalhes = (perguntas ?? []).map((p: { id: string; tipo: string; label: string; ordem: number }) => ({
      pergunta_id: p.id,
      tipo: p.tipo,
      label: p.label,
      valor: answerMap[p.id] ?? '',
    }))

    return NextResponse.json({ detalhes })
  }

  // Listagem paginada
  let query = db
    .from('form_responses')
    .select(
      'id, lead_id, completude, concluido, utm_source, utm_medium, utm_campaign, utm_term, utm_content, criado_em, leads(nome, email, whatsapp)',
      { count: 'exact' }
    )
    .eq('form_id', id)
    .order('criado_em', { ascending: false })
    .range(offset, offset + limite - 1)

  if (apenasAbandonados) {
    query = query.eq('concluido', false)
  } else {
    query = query.eq('concluido', true)
  }

  const { data: respostas, count } = await query

  // Estatísticas por pergunta (múltipla escolha + pontuacao)
  const { data: perguntas } = await db
    .from('form_questions')
    .select('id, tipo, label, opcoes, ordem')
    .eq('form_id', id)
    .in('tipo', ['multipla_escolha', 'pontuacao'])
    .order('ordem')

  const stats: Record<string, Record<string, number>> = {}
  if (perguntas && perguntas.length > 0) {
    const qIds = perguntas.map((p: { id: string }) => p.id)
    const { data: answers } = await db
      .from('form_answers')
      .select('question_id, valor, form_responses!inner(form_id, concluido)')
      .eq('form_responses.form_id', id)
      .eq('form_responses.concluido', true)
      .in('question_id', qIds)

    for (const a of answers ?? []) {
      if (!stats[a.question_id]) stats[a.question_id] = {}
      stats[a.question_id][a.valor] = (stats[a.question_id][a.valor] ?? 0) + 1
    }
  }

  // Contagem de abandonados
  const { count: totalAbandonados } = await db
    .from('form_responses')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', id)
    .eq('concluido', false)

  // Contagem total concluídos
  const { count: totalConcluidos } = await db
    .from('form_responses')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', id)
    .eq('concluido', true)

  return NextResponse.json({
    respostas: respostas ?? [],
    total: count ?? 0,
    total_concluidos: totalConcluidos ?? 0,
    total_abandonados: totalAbandonados ?? 0,
    stats,
    perguntas_stats: perguntas ?? [],
  })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const { searchParams } = new URL(req.url)
  const responseId = searchParams.get('response_id')
  if (!responseId) return NextResponse.json({ error: 'response_id required' }, { status: 400 })
  await db.from('form_answers').delete().eq('response_id', responseId)
  const { error } = await db
    .from('form_responses').delete()
    .eq('id', responseId).eq('form_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
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

  const { data: respostas, count } = await db
    .from('form_responses')
    .select('id, lead_id, completude, concluido, utm_source, utm_medium, utm_campaign, criado_em, leads(nome, email, whatsapp)', { count: 'exact' })
    .eq('form_id', id)
    .order('criado_em', { ascending: false })
    .range(offset, offset + limite - 1)

  // Estatísticas por pergunta (múltipla escolha)
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
      .select('question_id, valor, form_responses!inner(form_id)')
      .eq('form_responses.form_id', id)
      .in('question_id', qIds)

    for (const a of answers ?? []) {
      if (!stats[a.question_id]) stats[a.question_id] = {}
      stats[a.question_id][a.valor] = (stats[a.question_id][a.valor] ?? 0) + 1
    }
  }

  return NextResponse.json({
    respostas: respostas ?? [],
    total: count ?? 0,
    stats,
    perguntas_stats: perguntas ?? [],
  })
}

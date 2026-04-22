import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const { data, error } = await db
    .from('form_questions')
    .select('*')
    .eq('form_id', id)
    .order('ordem', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const body = await req.json()

  // Reordenar em massa
  if (Array.isArray(body)) {
    for (const q of body) {
      await db.from('form_questions').update({ ordem: q.ordem }).eq('id', q.id).eq('form_id', id)
    }
    return NextResponse.json({ ok: true })
  }

  const { tipo, label, descricao, placeholder, opcoes, obrigatorio, ordem } = body
  if (!tipo || !label?.trim()) return NextResponse.json({ error: 'tipo e label obrigatórios' }, { status: 400 })

  // Calcula próxima ordem
  const ordemFinal = typeof ordem === 'number' ? ordem : await db
    .from('form_questions').select('ordem').eq('form_id', id).order('ordem', { ascending: false }).limit(1)
    .then(({ data }: { data: { ordem: number }[] | null }) => (data?.[0]?.ordem ?? -1) + 1)

  const { data, error } = await db.from('form_questions').insert({
    form_id: id, tipo, label: label.trim(),
    descricao: descricao || null, placeholder: placeholder || null,
    opcoes: opcoes || null, obrigatorio: obrigatorio ?? true, ordem: ordemFinal,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const body = await req.json()
  const { question_id, ...campos } = body
  if (!question_id) return NextResponse.json({ error: 'question_id obrigatório' }, { status: 400 })
  const PERMITIDOS = ['tipo', 'label', 'descricao', 'placeholder', 'opcoes', 'obrigatorio', 'ordem']
  const update: Record<string, unknown> = {}
  for (const k of PERMITIDOS) { if (k in campos) update[k] = campos[k] }
  const { data, error } = await db.from('form_questions').update(update).eq('id', question_id).eq('form_id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const { searchParams } = new URL(req.url)
  const question_id = searchParams.get('question_id')
  if (!question_id) return NextResponse.json({ error: 'question_id obrigatório' }, { status: 400 })
  const { error } = await db.from('form_questions').delete().eq('id', question_id).eq('form_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

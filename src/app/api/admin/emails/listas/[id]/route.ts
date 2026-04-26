import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const db = () => createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
type P = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params
  const { data, error } = await db().from('email_listas').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json({ lista: data })
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params
  const body = await req.json()
  const allowed = ['nome', 'descricao', 'tags']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]
  const { data, error } = await db().from('email_listas').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lista: data })
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params
  const { error } = await db().from('email_listas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

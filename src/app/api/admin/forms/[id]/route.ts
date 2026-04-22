import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const { data, error } = await db.from('forms').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const body = await req.json()
  const PERMITIDOS = ['titulo', 'descricao', 'modo_exibicao', 'status', 'config', 'envio_email', 'envio_whatsapp', 'webhook_url']
  const update: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  for (const k of PERMITIDOS) { if (k in body) update[k] = body[k] }
  const { data, error } = await db.from('forms').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const { error } = await db.from('forms').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

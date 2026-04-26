import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const db = () => createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
type P = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'ativo'
  const page = Number(searchParams.get('page') || 1)
  const limit = 50
  const offset = (page - 1) * limit

  const { data, error, count } = await db()
    .from('email_lista_contatos')
    .select('*', { count: 'exact' })
    .eq('lista_id', id)
    .eq('status', status)
    .order('criado_em', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contatos: data ?? [], total: count ?? 0, page, limit })
}

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params
  const { email, nome, tags, origem } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })

  const { data, error } = await db()
    .from('email_lista_contatos')
    .upsert({ lista_id: id, email: email.trim().toLowerCase(), nome: nome?.trim() || null, tags: tags ?? [], origem: origem || 'manual', status: 'ativo' }, { onConflict: 'lista_id,email' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contato: data }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: P) {
  const { id } = await params
  const { contato_id } = await req.json()
  const { error } = await db().from('email_lista_contatos').delete().eq('id', contato_id).eq('lista_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

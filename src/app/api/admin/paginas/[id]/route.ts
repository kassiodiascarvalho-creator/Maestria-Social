import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { data, error } = await db().from('paginas').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json({ pagina: data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()

  const allowed = ['nome', 'slug', 'descricao', 'conteudo', 'configuracoes', 'publicada']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  if (!Object.keys(update).length)
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const { data, error } = await db().from('paginas').update(update).eq('id', id).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug já existe' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ pagina: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { error } = await db().from('paginas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

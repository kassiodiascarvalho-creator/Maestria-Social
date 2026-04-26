import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const db = () => createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await db()
    .from('email_listas')
    .select('*, email_lista_contatos(count)')
    .order('criado_em', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ listas: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { nome, descricao, tags } = await req.json()
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  const { data, error } = await db()
    .from('email_listas')
    .insert({ nome: nome.trim(), descricao: descricao?.trim() || null, tags: tags ?? [] })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lista: data }, { status: 201 })
}

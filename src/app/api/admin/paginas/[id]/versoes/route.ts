import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const { data, error } = await db()
    .from('paginas_versoes')
    .select('id, nome, criado_em')
    .eq('pagina_id', id)
    .order('criado_em', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ versoes: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { nome, conteudo, configuracoes } = await req.json()
  const { data, error } = await db()
    .from('paginas_versoes')
    .insert({ pagina_id: id, nome, conteudo, configuracoes })
    .select('id, nome, criado_em')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ versao: data }, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { versao_id } = await req.json()

  const { data: versao } = await db()
    .from('paginas_versoes')
    .select('conteudo, configuracoes')
    .eq('id', versao_id)
    .eq('pagina_id', id)
    .single()

  if (!versao) return NextResponse.json({ error: 'Versão não encontrada' }, { status: 404 })

  const { data, error } = await db()
    .from('paginas')
    .update({ conteudo: versao.conteudo, configuracoes: versao.configuracoes })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pagina: data })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — lista todas as listas com contagem de contatos
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { data, error } = await db
    .from('wpp_listas')
    .select('id, nome, criado_em, wpp_contatos(count)')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const listas = (data ?? []).map((l: Record<string, unknown>) => ({
    id: l.id,
    nome: l.nome,
    criado_em: l.criado_em,
    total_contatos: Array.isArray(l.wpp_contatos) ? (l.wpp_contatos[0] as { count: number })?.count ?? 0 : 0,
  }))

  return NextResponse.json(listas)
}

// POST — cria uma nova lista
export async function POST(req: NextRequest) {
  const { nome } = await req.json() as { nome: string }
  if (!nome?.trim()) return NextResponse.json({ error: 'nome obrigatório' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { data, error } = await db
    .from('wpp_listas')
    .insert({ nome: nome.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

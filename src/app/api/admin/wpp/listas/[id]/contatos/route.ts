import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function normalizarTelefone(raw: string): string {
  return raw.replace(/\D/g, '')
}

// GET — busca contatos de uma lista
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { data, error } = await db
    .from('wpp_contatos')
    .select('id, nome, telefone, criado_em')
    .eq('lista_id', id)
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — adiciona contatos em lote (ou manual)
// body: { contatos: Array<{ nome?: string, telefone: string }> }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { contatos } = await req.json() as { contatos: Array<{ nome?: string; telefone: string }> }

  if (!Array.isArray(contatos) || contatos.length === 0) {
    return NextResponse.json({ error: 'contatos[] obrigatório' }, { status: 400 })
  }

  const rows = contatos
    .map(c => ({ lista_id: id, nome: c.nome?.trim() || null, telefone: normalizarTelefone(c.telefone) }))
    .filter(c => c.telefone.length >= 8)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nenhum telefone válido encontrado' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { data, error } = await db
    .from('wpp_contatos')
    .upsert(rows, { ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inseridos: data?.length ?? rows.length })
}

// DELETE — remove um contato específico
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listaId } = await params
  const { contatoId } = await req.json() as { contatoId: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { error } = await db
    .from('wpp_contatos')
    .delete()
    .eq('id', contatoId)
    .eq('lista_id', listaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

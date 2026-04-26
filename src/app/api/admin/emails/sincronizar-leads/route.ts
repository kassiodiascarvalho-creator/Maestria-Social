import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Busca ou cria uma lista pelo nome, retorna o id
async function obterOuCriarLista(db: any, nome: string): Promise<string> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: existente } = await db
    .from('email_listas')
    .select('id')
    .eq('nome', nome)
    .single()
  if (existente) return existente.id

  const { data: nova } = await db
    .from('email_listas')
    .insert({ nome, descricao: 'Lista sincronizada automaticamente' })
    .select('id')
    .single()
  return nova.id
}

export async function POST(req: NextRequest) {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { lista_id, filtro_status, filtro_origem } = await req.json().catch(() => ({}))

  // Busca leads com email
  let query = db.from('leads').select('id, nome, email, whatsapp, origem, status').not('email', 'is', null).neq('email', '')
  if (filtro_status) query = query.eq('status', filtro_status)
  if (filtro_origem) query = query.ilike('origem', `%${filtro_origem}%`)

  const { data: leads, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ ok: true, importados: 0, mensagem: 'Nenhum lead com e-mail encontrado' })

  // Define lista de destino
  const listaId = lista_id || await obterOuCriarLista(db, '📋 Leads — Todos')

  // Monta contatos para upsert
  const contatos = leads.map((l: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    lista_id: listaId,
    lead_id: l.id,
    email: l.email.trim().toLowerCase(),
    nome: l.nome || null,
    origem: l.origem || 'leads',
    status: 'ativo',
  }))

  // Insere em lotes de 500
  let importados = 0
  const LOTE = 500
  for (let i = 0; i < contatos.length; i += LOTE) {
    const { data } = await db
      .from('email_lista_contatos')
      .upsert(contatos.slice(i, i + LOTE), { onConflict: 'lista_id,email', ignoreDuplicates: false })
      .select('id')
    if (data) importados += data.length
  }

  return NextResponse.json({ ok: true, importados, total: leads.length, lista_id: listaId })
}

// GET: retorna contagem de leads com email disponíveis
export async function GET() {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { count } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .not('email', 'is', null)
    .neq('email', '')
  return NextResponse.json({ total_com_email: count ?? 0 })
}

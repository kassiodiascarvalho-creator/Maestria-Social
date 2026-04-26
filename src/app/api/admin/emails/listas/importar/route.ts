import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const db = () => createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

export async function POST(req: NextRequest) {
  const { lista_id, contatos, origem } = await req.json() as {
    lista_id: string
    contatos: { email: string; nome?: string; tags?: string[] }[]
    origem?: string
  }

  if (!lista_id || !contatos?.length)
    return NextResponse.json({ error: 'lista_id e contatos são obrigatórios' }, { status: 400 })

  // Deduplicar por email antes de inserir
  const vistos = new Set<string>()
  const unicos = contatos
    .filter(c => {
      const e = c.email?.trim().toLowerCase()
      if (!e || !e.includes('@') || vistos.has(e)) return false
      vistos.add(e)
      return true
    })
    .map(c => ({
      lista_id,
      email: c.email.trim().toLowerCase(),
      nome: c.nome?.trim() || null,
      tags: c.tags ?? [],
      origem: origem || 'csv',
      status: 'ativo',
    }))

  if (!unicos.length)
    return NextResponse.json({ error: 'Nenhum e-mail válido encontrado' }, { status: 400 })

  // Inserir em lotes de 500
  let importados = 0
  let duplicados = 0
  const LOTE = 500
  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE)
    const { data, error } = await db()
      .from('email_lista_contatos')
      .upsert(lote, { onConflict: 'lista_id,email', ignoreDuplicates: false })
      .select('id')
    if (!error && data) importados += data.length
    else if (error?.code === '23505') duplicados += lote.length
  }

  return NextResponse.json({ ok: true, importados, duplicados, total: unicos.length })
}

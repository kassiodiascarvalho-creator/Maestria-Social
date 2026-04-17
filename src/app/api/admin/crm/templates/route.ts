import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET — lista todos os templates
export async function GET() {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('crm_templates')
    .select('id, nome, conteudo, criado_em')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — cria template { nome, conteudo }
export async function POST(req: NextRequest) {
  const { nome, conteudo } = await req.json()
  if (!nome?.trim() || !conteudo?.trim()) {
    return NextResponse.json({ error: 'nome e conteudo são obrigatórios' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('crm_templates')
    .insert({ nome: nome.trim(), conteudo: conteudo.trim() })
    .select('id, nome, conteudo, criado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

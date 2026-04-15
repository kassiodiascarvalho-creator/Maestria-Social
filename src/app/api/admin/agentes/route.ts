import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ag = (admin: ReturnType<typeof createAdminClient>) => (admin as any).from('agentes')

// GET — lista todos os agentes
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await ag(admin).select('*').order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — cria novo agente
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome, descricao, prompt, temperatura, modelo, ativo, canais } = body

  if (!nome?.trim()) return NextResponse.json({ error: '"nome" é obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await ag(admin)
    .insert({
      nome: nome.trim(),
      descricao: descricao?.trim() || '',
      prompt: prompt || '',
      temperatura: temperatura ?? 0.2,
      modelo: modelo || 'gpt-4.1-mini',
      ativo: ativo ?? true,
      canais: canais || [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

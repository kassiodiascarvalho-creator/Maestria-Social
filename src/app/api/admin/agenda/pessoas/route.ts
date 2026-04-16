import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('agenda_pessoas')
    .select('id, nome, bio, role, email, foto_url, foto_pos_x, foto_pos_y, foto_scale, slug, duracao_slot, ativo, google_refresh_token, criado_em')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { nome, bio = '', role = '', email = '', duracao_slot = 30 } = body

  if (!nome?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const slugBase = gerarSlug(nome)

  // Garante slug único
  let slug = slugBase
  let tentativa = 1
  while (true) {
    const { data: existente } = await admin.from('agenda_pessoas').select('id').eq('slug', slug).maybeSingle()
    if (!existente) break
    slug = `${slugBase}-${++tentativa}`
  }

  const { data, error } = await admin
    .from('agenda_pessoas')
    .insert({ nome: nome.trim(), bio, role, email, slug, duracao_slot })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cria campos padrão (nome, email, whatsapp)
  await admin.from('agenda_campos').insert([
    { pessoa_id: data.id, label: 'Nome completo', tipo: 'text', obrigatorio: true, ordem: 0 },
    { pessoa_id: data.id, label: 'E-mail', tipo: 'email', obrigatorio: true, ordem: 1 },
    { pessoa_id: data.id, label: 'WhatsApp', tipo: 'phone', obrigatorio: true, ordem: 2 },
  ])

  return NextResponse.json(data, { status: 201 })
}

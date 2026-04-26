import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { data, error } = await supabase
    .from('paginas')
    .select('id, nome, slug, descricao, publicada, criado_em, atualizado_em')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ paginas: data ?? [] })
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const body = await req.json()
  const { nome, slug: slugInput, descricao, conteudo, configuracoes, publicada } = body

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }

  const slug = slugInput?.trim() || slugify(nome)

  const { data, error } = await supabase
    .from('paginas')
    .insert({
      nome: nome.trim(), slug,
      descricao: descricao?.trim() || null,
      conteudo: conteudo ?? [],
      configuracoes: configuracoes ?? {},
      publicada: publicada ?? true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma página com esse slug' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ pagina: data }, { status: 201 })
}

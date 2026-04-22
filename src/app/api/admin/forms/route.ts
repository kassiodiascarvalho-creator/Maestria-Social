import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function gerarSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    + '-' + Math.random().toString(36).slice(2, 7)
}

export async function GET() {
  const db = createAdminClient() as any
  const { data: forms, error } = await db
    .from('forms')
    .select('id, slug, titulo, descricao, status, modo_exibicao, criado_em, atualizado_em')
    .order('criado_em', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!forms?.length) return NextResponse.json([])

  // Conta respostas concluídas reais por form
  const { data: respostas } = await db
    .from('form_responses')
    .select('form_id')
    .eq('concluido', true)

  const contagem: Record<string, number> = {}
  for (const r of respostas ?? []) {
    contagem[r.form_id] = (contagem[r.form_id] ?? 0) + 1
  }

  return NextResponse.json(forms.map((f: Record<string, unknown>) => ({
    ...f,
    total_respostas: contagem[f.id as string] ?? 0,
  })))
}

export async function POST(req: NextRequest) {
  const db = createAdminClient() as any
  const body = await req.json()
  const { titulo, descricao, modo_exibicao } = body
  if (!titulo?.trim()) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })

  const slug = gerarSlug(titulo)
  const { data, error } = await db.from('forms').insert({
    titulo: titulo.trim(),
    descricao: descricao?.trim() || null,
    slug,
    modo_exibicao: modo_exibicao ?? 'uma_por_vez',
    status: 'rascunho',
    config: {
      cor_fundo: '#0d0d0d',
      cor_texto: '#ffffff',
      cor_botao: '#c2a44a',
      cor_texto_botao: '#0d0d0d',
      arredondamento: 8,
      fonte: 'Inter',
      alinhamento: 'center',
    },
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

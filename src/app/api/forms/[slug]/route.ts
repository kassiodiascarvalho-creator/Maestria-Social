import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = createAdminClient() as any

  const { data: form, error } = await db
    .from('forms')
    .select('id, slug, titulo, descricao, modo_exibicao, status, config')
    .eq('slug', slug)
    .eq('status', 'ativo')
    .single()

  if (error || !form) {
    return NextResponse.json({ error: 'Formulário não encontrado' }, { status: 404 })
  }

  const { data: perguntas } = await db
    .from('form_questions')
    .select('id, tipo, label, descricao, placeholder, opcoes, obrigatorio, ordem')
    .eq('form_id', form.id)
    .order('ordem', { ascending: true })

  return NextResponse.json({ ...form, perguntas: perguntas ?? [] })
}

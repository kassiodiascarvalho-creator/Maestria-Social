import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH — editar assunto e corpo de um template
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { assunto, corpo_html, ativo } = body as {
    assunto?: string
    corpo_html?: string
    ativo?: boolean
  }

  const supabase = createAdminClient()
  const update: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  if (assunto !== undefined) update.assunto = assunto
  if (corpo_html !== undefined) update.corpo_html = corpo_html
  if (ativo !== undefined) update.ativo = ativo

  const { data, error } = await supabase
    .from('email_templates')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const db = () => createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await db()
    .from('email_campanhas')
    .select('*, email_listas(nome)')
    .order('criado_em', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campanhas: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    nome, assunto_a, assunto_b, pre_header,
    remetente_nome, remetente_email,
    lista_id, template_id, html, texto,
    ab_ativo, ab_percentual, agendado_para,
  } = body

  if (!nome?.trim() || !assunto_a?.trim() || !remetente_email?.trim())
    return NextResponse.json({ error: 'nome, assunto e remetente_email são obrigatórios' }, { status: 400 })

  const { data, error } = await db()
    .from('email_campanhas')
    .insert({
      nome: nome.trim(), assunto_a: assunto_a.trim(),
      assunto_b: assunto_b?.trim() || null,
      pre_header: pre_header?.trim() || null,
      remetente_nome: remetente_nome?.trim() || 'Maestria Social',
      remetente_email: remetente_email.trim(),
      lista_id: lista_id || null, template_id: template_id || null,
      html: html || null, texto: texto || null,
      ab_ativo: ab_ativo ?? false, ab_percentual: ab_percentual ?? 50,
      agendado_para: agendado_para || null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campanha: data }, { status: 201 })
}

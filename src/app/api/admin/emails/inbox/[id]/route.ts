import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  const [{ data: conversa }, { data: mensagens }] = await Promise.all([
    db.from('conversas_email').select('*').eq('id', id).single(),
    db.from('mensagens_email').select('*').eq('conversa_id', id).order('criado_em', { ascending: true }),
  ])

  if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

  // Enriquece com dados do lead (sem depender de FK)
  if (conversa.lead_id) {
    const { data: lead } = await db.from('leads').select('id,nome,telefone,email').eq('id', conversa.lead_id).single()
    if (lead) conversa.leads = lead
  }
  if (conversa.campanha_id) {
    const { data: camp } = await db.from('email_campanhas').select('id,nome').eq('id', conversa.campanha_id).single()
    if (camp) conversa.email_campanhas = camp
  }

  // Marca não lidas como lidas
  if (conversa.nao_lidas > 0) {
    await Promise.all([
      db.from('mensagens_email').update({ lida: true }).eq('conversa_id', id).eq('lida', false),
      db.from('conversas_email').update({ nao_lidas: 0 }).eq('id', id),
    ])
  }

  return NextResponse.json({ conversa, mensagens: mensagens || [] })
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params
  const body = await req.json()
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  const campos: Record<string, unknown> = {}
  if (body.status) campos.status = body.status

  if (!Object.keys(campos).length) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })

  const { error } = await db.from('conversas_email').update(campos).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

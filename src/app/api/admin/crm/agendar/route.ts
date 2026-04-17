import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET — lista mensagens agendadas (opcionalmente por lead_id)
export async function GET(req: NextRequest) {
  const leadId = new URL(req.url).searchParams.get('lead_id') || ''
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('tarefas_agendadas')
    .select('id, lead_id, payload, agendado_para, status, criado_em')
    .eq('tipo', 'whatsapp_msg')
    .in('status', ['pendente', 'enviada'])
    .order('agendado_para', { ascending: true })
    .limit(100)

  if (leadId) query = query.eq('lead_id', leadId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — cria mensagem agendada { lead_id, texto, agendado_para }
export async function POST(req: NextRequest) {
  const { lead_id, texto, agendado_para } = await req.json()
  if (!lead_id || !texto?.trim() || !agendado_para) {
    return NextResponse.json({ error: 'lead_id, texto e agendado_para são obrigatórios' }, { status: 400 })
  }

  const dataAgendamento = new Date(agendado_para)
  if (isNaN(dataAgendamento.getTime()) || dataAgendamento < new Date()) {
    return NextResponse.json({ error: 'agendado_para deve ser uma data futura válida' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('tarefas_agendadas')
    .insert({
      lead_id,
      tipo: 'whatsapp_msg',
      payload: { texto: texto.trim(), from_crm: true },
      agendado_para: dataAgendamento.toISOString(),
      status: 'pendente',
    })
    .select('id, lead_id, payload, agendado_para, status, criado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — cancela mensagem agendada { id }
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('tarefas_agendadas')
    .update({ status: 'cancelada' })
    .eq('id', id)
    .eq('status', 'pendente')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

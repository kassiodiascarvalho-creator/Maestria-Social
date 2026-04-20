import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  const [leadRes, qualsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('leads').select('*').eq('id', id).single(),
    supabase
      .from('qualificacoes')
      .select('id, campo, valor, criado_em')
      .eq('lead_id', id)
      .order('criado_em', { ascending: true }),
  ])

  if (leadRes.error) return NextResponse.json({ error: leadRes.error.message }, { status: 500 })

  return NextResponse.json({ ...leadRes.data, qualificacoes: qualsRes.data ?? [] })
}

const CAMPOS_PERMITIDOS = ['pipeline_etapa', 'notas_crm', 'etiqueta', 'status_lead']

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const update: Record<string, unknown> = {}
  for (const key of CAMPOS_PERMITIDOS) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('leads')
    .update(update)
    .eq('id', id)
    .select('id, pipeline_etapa, notas_crm, etiqueta, status_lead')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

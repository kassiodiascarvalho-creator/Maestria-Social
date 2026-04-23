import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const agenteId = req.nextUrl.searchParams.get('agente_id')

  let query = supabase
    .from('followup_fluxos')
    .select('*, followup_configs(id, nome, ordem, horas_apos, horas_sem_resposta, mensagem, ativo)')
    .order('criado_em')
    .order('ordem', { referencedTable: 'followup_configs' })

  if (agenteId) query = query.eq('agente_id', agenteId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const body = await req.json()

  const { data, error } = await supabase
    .from('followup_fluxos')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { id } = await params
  const raw = await req.json()

  // Só permite atualizar colunas que existem na tabela followup_fluxos
  const COLUNAS_PERMITIDAS = ['nome', 'tipo', 'ativo', 'ao_finalizar', 'fluxo_destino_id',
    'fluxo_ao_responder_id', 'condicao_parada', 'agente_id']
  const body: Record<string, unknown> = {}
  for (const col of COLUNAS_PERMITIDAS) {
    if (Object.prototype.hasOwnProperty.call(raw, col)) body[col] = raw[col]
  }

  const { data, error } = await supabase
    .from('followup_fluxos')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { id } = await params

  const { error } = await supabase.from('followup_fluxos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

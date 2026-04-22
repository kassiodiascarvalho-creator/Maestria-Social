import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createAdminClient() as any
  const { data } = await db
    .from('cadencia_flows')
    .select('id, nome, descricao, trigger_tipo, status, total_execucoes, criado_em, atualizado_em')
    .order('criado_em', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const db = createAdminClient() as any
  const body = await req.json()
  const { nome, descricao, trigger_tipo } = body
  const { data, error } = await db
    .from('cadencia_flows')
    .insert({ nome: nome || 'Novo Fluxo', descricao, trigger_tipo: trigger_tipo || 'manual' })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
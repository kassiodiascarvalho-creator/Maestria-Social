import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { data, error } = await supabase
    .from('pipeline_etapas')
    .select('*')
    .order('ordem')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const body = await req.json()

  // Gera slug a partir do label se não fornecido
  if (!body.slug && body.label) {
    body.slug = body.label
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
  }

  // Ordem = max + 1
  const { data: last } = await supabase
    .from('pipeline_etapas').select('ordem').order('ordem', { ascending: false }).limit(1).single()
  body.ordem = (last?.ordem ?? -1) + 1

  const { data, error } = await supabase.from('pipeline_etapas').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

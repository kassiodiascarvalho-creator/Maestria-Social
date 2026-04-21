import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { id } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('pipeline_etapas').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { id } = await params

  // Busca o slug para verificar leads nessa etapa
  const { data: etapa } = await supabase
    .from('pipeline_etapas').select('slug').eq('id', id).single()
  if (!etapa) return NextResponse.json({ error: 'Etapa não encontrada' }, { status: 404 })

  const { count } = await supabase
    .from('leads').select('id', { count: 'exact', head: true })
    .eq('pipeline_etapa', etapa.slug)

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Existem ${count} lead(s) nessa etapa. Mova-os antes de excluir.`, count },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('pipeline_etapas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

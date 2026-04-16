import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status } = body

  const statusValidos = ['confirmado', 'iniciado', 'realizado', 'cancelado', 'no_show']
  if (!statusValidos.includes(status)) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('agenda_agendamentos')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se cancelado, desbloquear o slot na agenda_excecoes
  if (status === 'cancelado') {
    const { data: ag } = await admin
      .from('agenda_agendamentos')
      .select('pessoa_id, data, horario')
      .eq('id', id)
      .single()
    if (ag) {
      await admin
        .from('agenda_excecoes')
        .delete()
        .eq('pessoa_id', ag.pessoa_id)
        .eq('data', ag.data)
        .eq('tipo', 'bloqueado')
        .eq('inicio', ag.horario)
    }
  }

  return NextResponse.json(data)
}

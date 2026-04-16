import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const inicio = req.nextUrl.searchParams.get('inicio')
  const fim = req.nextUrl.searchParams.get('fim')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  let query = admin
    .from('agenda_agendamentos')
    .select('*, agenda_pessoas(id, nome, role, foto_url, foto_pos_x, foto_pos_y, foto_scale)')
    .order('data')
    .order('horario')

  if (inicio) query = query.gte('data', inicio)
  if (fim) query = query.lte('data', fim)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

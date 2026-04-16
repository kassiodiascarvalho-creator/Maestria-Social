import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import HorariosEditor from './HorariosEditor'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function HorariosPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: pessoa } = await admin.from('agenda_pessoas').select('id, nome, role, foto_url, foto_pos_x, foto_pos_y, foto_scale').eq('id', id).single()
  if (!pessoa) notFound()

  const { data: horarios } = await admin.from('agenda_horarios').select('*').eq('pessoa_id', id).order('dia_semana').order('inicio')

  return <HorariosEditor pessoa={pessoa} horariosIniciais={horarios ?? []} />
}

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CamposEditor from './CamposEditor'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function CamposPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: pessoa } = await admin
    .from('agenda_pessoas')
    .select('id, nome, role')
    .eq('id', id)
    .single()
  if (!pessoa) notFound()

  const { data: campos } = await admin
    .from('agenda_campos')
    .select('*')
    .eq('pessoa_id', id)
    .order('ordem')

  return <CamposEditor pessoa={pessoa} camposIniciais={campos ?? []} />
}

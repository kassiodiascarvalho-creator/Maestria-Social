import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import AgendaEditor from './AgendaEditor'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ google?: string }> }

export default async function AgendaPessoaPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params
  const { google } = await searchParams

  if (id === 'nova') {
    return <AgendaEditor pessoa={null} googleStatus={google} />
  }

  const admin = createAdminClient()
  const { data } = await admin.from('agenda_pessoas').select('*').eq('id', id).single()
  if (!data) notFound()

  return <AgendaEditor pessoa={data as PessoaDB} googleStatus={google} />
}

export type PessoaDB = {
  id: string; nome: string; bio: string; role: string; email: string
  foto_url: string | null; foto_pos_x: number; foto_pos_y: number; foto_scale: number
  slug: string; duracao_slot: number; ativo: boolean; google_refresh_token: string | null
}

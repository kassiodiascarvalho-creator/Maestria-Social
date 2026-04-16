import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import AgendarView from './AgendarView'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export default async function AgendarPage({ params }: Props) {
  const { slug } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: pessoa } = await admin
    .from('agenda_pessoas')
    .select('id, nome, role, foto_url, foto_pos_x, foto_pos_y, foto_scale, duracao_slot, slug')
    .eq('slug', slug)
    .single()
  if (!pessoa) notFound()

  const { data: horarios } = await admin
    .from('agenda_horarios')
    .select('*')
    .eq('pessoa_id', pessoa.id)
    .eq('ativo', true)
    .order('dia_semana')

  const { data: excecoes } = await admin
    .from('agenda_excecoes')
    .select('*')
    .eq('pessoa_id', pessoa.id)
    .order('data')

  const { data: campos } = await admin
    .from('agenda_campos')
    .select('*')
    .eq('pessoa_id', pessoa.id)
    .order('ordem')

  return (
    <AgendarView
      pessoa={pessoa}
      horarios={horarios ?? []}
      excecoes={excecoes ?? []}
      campos={campos ?? []}
    />
  )
}

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarioView from './CalendarioView'

export const dynamic = 'force-dynamic'

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Semana atual
  const hoje = new Date()
  const diaSemana = hoje.getDay()
  const segunda = new Date(hoje)
  segunda.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
  const domingo = new Date(segunda)
  domingo.setDate(segunda.getDate() + 6)

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: agendamentos } = await admin
    .from('agenda_agendamentos')
    .select('*, agenda_pessoas(id, nome, role, foto_url)')
    .gte('data', fmtDate(segunda))
    .lte('data', fmtDate(domingo))
    .order('data')
    .order('horario')

  const { data: pessoas } = await admin
    .from('agenda_pessoas')
    .select('id, nome, role')
    .eq('ativo', true)
    .order('nome')

  return (
    <CalendarioView
      agendamentosIniciais={agendamentos ?? []}
      pessoas={pessoas ?? []}
      semanaInicialStr={fmtDate(segunda)}
    />
  )
}

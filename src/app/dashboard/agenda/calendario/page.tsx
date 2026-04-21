import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarioView from './CalendarioView'

export const dynamic = 'force-dynamic'

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Busca o próximo agendamento confirmado para iniciar na semana correta
  const hoje = new Date()
  const { data: proximoAg } = await admin
    .from('agenda_agendamentos')
    .select('data')
    .eq('status', 'confirmado')
    .gte('data', fmtDate(hoje))
    .order('data', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Se há um agendamento futuro, inicia na semana dele; senão, semana atual
  const dataRef = proximoAg?.data ? new Date(proximoAg.data + 'T12:00:00') : hoje
  const diaSemana = dataRef.getDay()
  const segunda = new Date(dataRef)
  segunda.setDate(dataRef.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1))
  const domingo = new Date(segunda)
  domingo.setDate(segunda.getDate() + 6)

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

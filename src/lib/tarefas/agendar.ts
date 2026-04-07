import { createAdminClient } from '@/lib/supabase/admin'

export type TipoTarefa = 'whatsapp_msg' | 'email' | 'recuperacao_quiz'

export interface AgendarTarefaInput {
  lead_id: string
  tipo: TipoTarefa
  payload: Record<string, unknown>
  agendado_para: Date | string
}

export async function agendarTarefa(input: AgendarTarefaInput) {
  const supabase = createAdminClient()
  const agendado =
    typeof input.agendado_para === 'string'
      ? input.agendado_para
      : input.agendado_para.toISOString()

  const { data, error } = await supabase
    .from('tarefas_agendadas')
    .insert({
      lead_id: input.lead_id,
      tipo: input.tipo,
      payload: input.payload,
      agendado_para: agendado,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[agendarTarefa]', error)
    throw error
  }
  return data
}

export async function agendarVarias(tarefas: AgendarTarefaInput[]) {
  if (tarefas.length === 0) return []
  const supabase = createAdminClient()
  const rows = tarefas.map((t) => ({
    lead_id: t.lead_id,
    tipo: t.tipo,
    payload: t.payload,
    agendado_para:
      typeof t.agendado_para === 'string'
        ? t.agendado_para
        : t.agendado_para.toISOString(),
  }))
  const { data, error } = await supabase
    .from('tarefas_agendadas')
    .insert(rows)
    .select('id')
  if (error) {
    console.error('[agendarVarias]', error)
    throw error
  }
  return data ?? []
}

export function emMinutos(minutos: number): Date {
  return new Date(Date.now() + minutos * 60_000)
}

export function emDias(dias: number): Date {
  return new Date(Date.now() + dias * 24 * 60 * 60_000)
}

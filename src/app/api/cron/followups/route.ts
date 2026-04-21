import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function autorizado(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const auth = req.headers.get('authorization') || ''
  if (auth === `Bearer ${expected}`) return true
  if (req.nextUrl.searchParams.get('secret') === expected) return true
  return false
}

function resolverMensagem(msg: string, vars: Record<string, string>): string {
  return msg
    .replace(/\{nome\}/g, vars.nome ?? '')
    .replace(/\{data_reuniao\}/g, vars.data_reuniao ?? '')
    .replace(/\{horario_reuniao\}/g, vars.horario_reuniao ?? '')
    .replace(/\{link_reuniao\}/g, vars.link_reuniao ?? '')
    .replace(/\{pilar_fraco\}/g, vars.pilar_fraco ?? '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buscarCanal(supabase: any, agenteId: string) {
  const { data } = await supabase.from('agentes').select('canais').eq('id', agenteId).single()
  const canal = data?.canais?.[0]
  return { canalProvider: canal?.provider ?? 'meta', canalInstanceId: canal?.id ?? null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarLembretes(supabase: any): Promise<number> {
  const agora = new Date()

  const { data: configs } = await supabase
    .from('followup_configs').select('*').eq('tipo', 'lembrete_reuniao').eq('ativo', true)

  if (!configs?.length) return 0
  let criadas = 0

  for (const cfg of configs) {
    const horasAntes = Number(cfg.horas_antes ?? 24)

    // Busca pessoas da agenda vinculadas ao agente
    const { data: pessoas } = await supabase
      .from('agenda_pessoas').select('id').eq('agente_id', cfg.agente_id)

    for (const pessoa of pessoas ?? []) {
      // Agendamentos confirmados nos próximos 7 dias
      const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

      const { data: agendamentos } = await supabase
        .from('agenda_agendamentos')
        .select('id, data, horario, meet_link, nome_lead, whatsapp_lead')
        .eq('pessoa_id', pessoa.id)
        .eq('status', 'confirmado')
        .lte('data', em7dias)

      for (const ag of agendamentos ?? []) {
        if (!ag.whatsapp_lead) continue

        // Converte data+horario SP → timestamp UTC para comparar
        const tsReuniao = new Date(`${ag.data}T${ag.horario}-03:00`).getTime()
        const tsAlvo   = agora.getTime() + horasAntes * 60 * 60 * 1000
        const diff     = Math.abs(tsReuniao - tsAlvo)

        // Janela ±30 minutos
        if (diff > 30 * 60 * 1000) continue

        // Busca lead pelo whatsapp
        const { data: lead } = await supabase
          .from('leads').select('id, nome, pilar_fraco').eq('whatsapp', ag.whatsapp_lead).single()

        if (!lead) continue

        // Dedup: já foi enviado para este agendamento?
        const { count } = await supabase
          .from('followup_enviados')
          .select('id', { count: 'exact', head: true })
          .eq('followup_id', cfg.id)
          .eq('lead_id', lead.id)
          .eq('agendamento_id', ag.id)

        if (count) continue

        const dataFmt = new Date(`${ag.data}T12:00:00`).toLocaleDateString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        const mensagem = resolverMensagem(cfg.mensagem, {
          nome: lead.nome ?? ag.nome_lead ?? '',
          data_reuniao: dataFmt,
          horario_reuniao: (ag.horario ?? '').slice(0, 5),
          link_reuniao: ag.meet_link ?? '',
          pilar_fraco: lead.pilar_fraco ?? '',
        })

        const { canalProvider, canalInstanceId } = await buscarCanal(supabase, cfg.agente_id)

        await supabase.from('tarefas_agendadas').insert({
          lead_id: lead.id, tipo: 'whatsapp_msg',
          payload: { texto: mensagem, agente_id: cfg.agente_id, canal_provider: canalProvider, canal_instance_id: canalInstanceId },
          agendado_para: new Date().toISOString(), status: 'pendente',
        })

        await supabase.from('followup_enviados').insert({
          followup_id: cfg.id, lead_id: lead.id, agendamento_id: ag.id,
        })

        criadas++
      }
    }
  }
  return criadas
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarReengajamento(supabase: any): Promise<number> {
  const agora = new Date()

  const { data: configs } = await supabase
    .from('followup_configs').select('*').eq('tipo', 'reengajamento').eq('ativo', true)
    .order('horas_sem_resposta')

  if (!configs?.length) return 0
  let criadas = 0

  for (const cfg of configs) {
    const horas = Number(cfg.horas_sem_resposta ?? 2)

    // Janela: última mensagem do assistant foi entre (agora - horas - 30min) e (agora - horas)
    const limite    = new Date(agora.getTime() - horas * 60 * 60 * 1000).toISOString()
    const limiteMin = new Date(agora.getTime() - (horas + 0.5) * 60 * 60 * 1000).toISOString()

    // Última mensagem do assistant (deste agente) por lead, na janela
    const { data: ultimas } = await supabase
      .from('conversas')
      .select('lead_id, criado_em')
      .eq('role', 'assistant')
      .eq('agente_id', cfg.agente_id)
      .lte('criado_em', limite)
      .gte('criado_em', limiteMin)

    for (const u of ultimas ?? []) {
      const leadId = u.lead_id
      if (!leadId) continue

      // Lead respondeu depois?
      const { count: respondeu } = await supabase
        .from('conversas').select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId).eq('role', 'user').gte('criado_em', u.criado_em)
      if (respondeu) continue

      // Valida etapa do lead
      const { data: lead } = await supabase
        .from('leads').select('nome, pilar_fraco, pipeline_etapa, whatsapp').eq('id', leadId).single()
      if (!lead?.whatsapp) continue
      if (['perdido', 'convertido', 'agendado'].includes(lead.pipeline_etapa ?? '')) continue

      // Dedup: já enviou este follow-up nas últimas 6h?
      const seisH = new Date(agora.getTime() - 6 * 60 * 60 * 1000).toISOString()
      const { count: jaEnviou } = await supabase
        .from('followup_enviados').select('id', { count: 'exact', head: true })
        .eq('followup_id', cfg.id).eq('lead_id', leadId).gte('enviado_em', seisH)
      if (jaEnviou) continue

      const mensagem = resolverMensagem(cfg.mensagem, {
        nome: lead.nome ?? '', pilar_fraco: lead.pilar_fraco ?? '',
        data_reuniao: '', horario_reuniao: '', link_reuniao: '',
      })

      const { canalProvider, canalInstanceId } = await buscarCanal(supabase, cfg.agente_id)

      await supabase.from('tarefas_agendadas').insert({
        lead_id: leadId, tipo: 'whatsapp_msg',
        payload: { texto: mensagem, agente_id: cfg.agente_id, canal_provider: canalProvider, canal_instance_id: canalInstanceId },
        agendado_para: new Date().toISOString(), status: 'pendente',
      })

      await supabase.from('followup_enviados').insert({
        followup_id: cfg.id, lead_id: leadId, agendamento_id: null,
      })

      criadas++
    }
  }
  return criadas
}

export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const [lembretes, reengajamento] = await Promise.all([
    processarLembretes(supabase),
    processarReengajamento(supabase),
  ])

  return NextResponse.json({ lembretes, reengajamento })
}

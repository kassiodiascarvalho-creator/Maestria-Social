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

// ─── Lembretes de reunião (configs sem fluxo_id) ──────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarLembretes(supabase: any): Promise<number> {
  const agora = new Date()
  const { data: configs } = await supabase
    .from('followup_configs').select('*').eq('tipo', 'lembrete_reuniao').eq('ativo', true)
  if (!configs?.length) return 0
  let criadas = 0

  for (const cfg of configs) {
    const horasAntes = Number(cfg.horas_antes ?? 24)
    const { data: pessoas } = await supabase
      .from('agenda_pessoas').select('id').eq('agente_id', cfg.agente_id)

    for (const pessoa of pessoas ?? []) {
      const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      const { data: agendamentos } = await supabase
        .from('agenda_agendamentos')
        .select('id, data, horario, meet_link, nome_lead, whatsapp_lead')
        .eq('pessoa_id', pessoa.id).eq('status', 'confirmado').lte('data', em7dias)

      for (const ag of agendamentos ?? []) {
        if (!ag.whatsapp_lead) continue
        const tsReuniao = new Date(`${ag.data}T${ag.horario}-03:00`).getTime()
        const tsAlvo   = agora.getTime() + horasAntes * 60 * 60 * 1000
        if (Math.abs(tsReuniao - tsAlvo) > 30 * 60 * 1000) continue

        const { data: lead } = await supabase
          .from('leads').select('id, nome, pilar_fraco').eq('whatsapp', ag.whatsapp_lead).single()
        if (!lead) continue

        const { count } = await supabase
          .from('followup_enviados').select('id', { count: 'exact', head: true })
          .eq('followup_id', cfg.id).eq('lead_id', lead.id).eq('agendamento_id', ag.id)
        if (count) continue

        const dataFmt = new Date(`${ag.data}T12:00:00`).toLocaleDateString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        const mensagem = resolverMensagem(cfg.mensagem, {
          nome: lead.nome ?? ag.nome_lead ?? '', data_reuniao: dataFmt,
          horario_reuniao: (ag.horario ?? '').slice(0, 5),
          link_reuniao: ag.meet_link ?? '', pilar_fraco: lead.pilar_fraco ?? '',
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

// ─── Reengajamento legado (configs sem fluxo_id) ──────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarReengajamento(supabase: any): Promise<number> {
  const agora = new Date()
  const { data: configs } = await supabase
    .from('followup_configs').select('*').eq('tipo', 'reengajamento').eq('ativo', true)
    .is('fluxo_id', null).order('horas_sem_resposta')
  if (!configs?.length) return 0
  let criadas = 0

  for (const cfg of configs) {
    const horas   = Number(cfg.horas_sem_resposta ?? 2)
    const limite  = new Date(agora.getTime() - horas * 60 * 60 * 1000).toISOString()
    const limiteMin = new Date(agora.getTime() - (horas + 0.5) * 60 * 60 * 1000).toISOString()

    const { data: ultimas } = await supabase
      .from('conversas').select('lead_id, criado_em')
      .eq('role', 'assistant').eq('agente_id', cfg.agente_id)
      .lte('criado_em', limite).gte('criado_em', limiteMin)

    for (const u of ultimas ?? []) {
      const leadId = u.lead_id
      if (!leadId) continue
      const { count: respondeu } = await supabase
        .from('conversas').select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId).eq('role', 'user').gte('criado_em', u.criado_em)
      if (respondeu) continue

      const { data: lead } = await supabase
        .from('leads').select('nome, pilar_fraco, pipeline_etapa, whatsapp').eq('id', leadId).single()
      if (!lead?.whatsapp) continue
      if (['perdido', 'convertido', 'agendado'].includes(lead.pipeline_etapa ?? '')) continue

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
      await supabase.from('followup_enviados').insert({ followup_id: cfg.id, lead_id: leadId, agendamento_id: null })
      criadas++
    }
  }
  return criadas
}

// ─── Detecta leads que responderam e move para o fluxo configurado ───────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarDeteccaoInteracao(supabase: any): Promise<number> {
  // Busca leads em fluxos que têm "ao responder → ir para fluxo X" configurado
  const { data: estados } = await supabase
    .from('followup_lead_estado')
    .select('lead_id, fluxo_id, followup_fluxos(tipo, agente_id, fluxo_ao_responder_id)')
    .eq('pausado', false)

  if (!estados?.length) return 0
  let movidos = 0

  for (const estado of estados ?? []) {
    const fluxo = estado.followup_fluxos
    // Pula fluxos sem destino configurado para resposta OU já no fluxo destino
    if (!fluxo?.fluxo_ao_responder_id) continue
    if (estado.fluxo_id === fluxo.fluxo_ao_responder_id) continue

    // Última mensagem desta conversa
    const { data: ultima } = await supabase
      .from('conversas').select('role, criado_em')
      .eq('lead_id', estado.lead_id)
      .order('criado_em', { ascending: false }).limit(1).single()

    if (!ultima || ultima.role !== 'user') continue

    // Verifica se o fluxo destino está ativo
    const { data: fluxoDestino } = await supabase
      .from('followup_fluxos').select('id, ativo')
      .eq('id', fluxo.fluxo_ao_responder_id).single()

    if (!fluxoDestino?.ativo) continue

    // Move para o fluxo configurado para resposta
    await supabase.from('followup_lead_estado').upsert({
      lead_id: estado.lead_id,
      fluxo_id: fluxo.fluxo_ao_responder_id,
      proxima_ordem: 0,
      ultima_atividade: ultima.criado_em,
      pausado: false,
    }, { onConflict: 'lead_id' })

    movidos++
  }
  return movidos
}

// ─── Entra leads em fluxos de inatividade que ainda não começaram ─────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarEntradaFluxos(supabase: any): Promise<number> {
  const agora = new Date()
  const { data: fluxos } = await supabase
    .from('followup_fluxos').select('id, agente_id, tipo, condicao_parada')
    .eq('ativo', true).in('tipo', ['inatividade', 'personalizado'])
  if (!fluxos?.length) return 0

  let entradas = 0

  for (const fluxo of fluxos) {
    // Primeira mensagem do fluxo
    const { data: primeiraMsg } = await supabase
      .from('followup_configs').select('horas_apos, horas_sem_resposta')
      .eq('fluxo_id', fluxo.id).eq('ativo', true).order('ordem').limit(1).single()
    if (!primeiraMsg) continue

    const horas = Number(primeiraMsg.horas_apos ?? primeiraMsg.horas_sem_resposta ?? 2)
    const limite  = new Date(agora.getTime() - horas * 60 * 60 * 1000).toISOString()
    const limiteMin = new Date(agora.getTime() - (horas + 0.5) * 60 * 60 * 1000).toISOString()

    // Última mensagem do assistant deste agente na janela
    const { data: ultimas } = await supabase
      .from('conversas').select('lead_id, criado_em')
      .eq('role', 'assistant').eq('agente_id', fluxo.agente_id)
      .lte('criado_em', limite).gte('criado_em', limiteMin)

    for (const u of ultimas ?? []) {
      const leadId = u.lead_id
      if (!leadId) continue

      // Lead respondeu depois?
      const { count: respondeu } = await supabase
        .from('conversas').select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId).eq('role', 'user').gte('criado_em', u.criado_em)
      if (respondeu) continue

      // Lead já está em algum fluxo?
      const { count: jaEmFluxo } = await supabase
        .from('followup_lead_estado').select('lead_id', { count: 'exact', head: true })
        .eq('lead_id', leadId)
      if (jaEmFluxo) continue

      // Lead em etapa terminal?
      const { data: lead } = await supabase
        .from('leads').select('pipeline_etapa').eq('id', leadId).single()
      if (['perdido', 'convertido'].includes(lead?.pipeline_etapa ?? '')) continue

      // Condição de parada: se exige agendamento, verifica se já agendou
      if (fluxo.condicao_parada === 'agendamento') {
        const { data: leadWpp } = await supabase
          .from('leads').select('whatsapp').eq('id', leadId).single()
        if (leadWpp?.whatsapp) {
          const { count: temAg } = await supabase
            .from('agenda_agendamentos').select('id', { count: 'exact', head: true })
            .eq('whatsapp_lead', leadWpp.whatsapp).eq('status', 'confirmado')
          if (temAg) continue
        }
      }

      await supabase.from('followup_lead_estado').insert({
        lead_id: leadId, fluxo_id: fluxo.id,
        proxima_ordem: 0, ultima_atividade: u.criado_em, pausado: false,
      })
      entradas++
    }
  }
  return entradas
}

// ─── Processa estados: envia a próxima mensagem de cada lead em um fluxo ──────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarEstados(supabase: any): Promise<number> {
  const agora = new Date()
  const { data: estados } = await supabase
    .from('followup_lead_estado')
    .select('*, followup_fluxos(id, agente_id, tipo, ativo, ao_finalizar, fluxo_destino_id, condicao_parada)')
    .eq('pausado', false)

  if (!estados?.length) return 0
  let enviadas = 0

  for (const estado of estados ?? []) {
    const fluxo = estado.followup_fluxos
    if (!fluxo?.ativo) continue

    const leadId = estado.lead_id

    // Verificar condição de parada: agendamento
    if (fluxo.condicao_parada === 'agendamento') {
      const { data: leadWpp } = await supabase
        .from('leads').select('whatsapp').eq('id', leadId).single()
      if (leadWpp?.whatsapp) {
        const { count: temAg } = await supabase
          .from('agenda_agendamentos').select('id', { count: 'exact', head: true })
          .eq('whatsapp_lead', leadWpp.whatsapp).eq('status', 'confirmado')
        if (temAg) {
          await supabase.from('followup_lead_estado').delete().eq('lead_id', leadId)
          continue
        }
      }
    }

    // Próxima mensagem do fluxo
    const { data: proxMsg } = await supabase
      .from('followup_configs').select('*')
      .eq('fluxo_id', estado.fluxo_id).eq('ordem', estado.proxima_ordem).eq('ativo', true)
      .single()

    if (!proxMsg) {
      // Fluxo terminou → aplicar ao_finalizar
      if (fluxo.ao_finalizar === 'proximo_fluxo' && fluxo.fluxo_destino_id) {
        await supabase.from('followup_lead_estado').update({
          fluxo_id: fluxo.fluxo_destino_id, proxima_ordem: 0,
          ultima_atividade: new Date().toISOString(),
        }).eq('lead_id', leadId)
      } else {
        await supabase.from('followup_lead_estado').delete().eq('lead_id', leadId)
      }
      continue
    }

    // Verificar janela de tempo
    const horasApos = Number(proxMsg.horas_apos ?? proxMsg.horas_sem_resposta ?? 1)
    const ultimaMs  = new Date(estado.ultima_atividade).getTime()
    const diffMs    = agora.getTime() - ultimaMs
    const janelaMenorMs = (horasApos - 0.5) * 60 * 60 * 1000
    const janelaMaxMs   = (horasApos + 1) * 60 * 60 * 1000

    if (diffMs < janelaMenorMs) continue  // ainda não é hora
    if (diffMs > janelaMaxMs) {
      // Janela perdida: avança para próxima mensagem sem enviar
      await supabase.from('followup_lead_estado').update({
        proxima_ordem: estado.proxima_ordem + 1,
        ultima_atividade: new Date().toISOString(),
      }).eq('lead_id', leadId)
      continue
    }

    // Para fluxo de interação: verifica se lead ainda não respondeu de novo
    if (fluxo.tipo === 'interacao') {
      const { count: respondeuDeNovo } = await supabase
        .from('conversas').select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId).eq('role', 'user')
        .gte('criado_em', estado.ultima_atividade)
      // Se respondeu de novo, mantém no fluxo de interação mas reinicia contagem
      if (respondeuDeNovo) {
        await supabase.from('followup_lead_estado').update({
          ultima_atividade: new Date().toISOString(),
        }).eq('lead_id', leadId)
        continue
      }
    }

    // Dedup: já enviou esta mensagem para este lead?
    const { count: jaEnviou } = await supabase
      .from('followup_enviados').select('id', { count: 'exact', head: true })
      .eq('followup_id', proxMsg.id).eq('lead_id', leadId)
      .gte('enviado_em', new Date(agora.getTime() - 2 * 60 * 60 * 1000).toISOString())
    if (jaEnviou) continue

    const { data: lead } = await supabase
      .from('leads').select('nome, pilar_fraco, whatsapp, pipeline_etapa').eq('id', leadId).single()
    if (!lead?.whatsapp) continue
    if (['perdido', 'convertido'].includes(lead.pipeline_etapa ?? '')) {
      await supabase.from('followup_lead_estado').delete().eq('lead_id', leadId)
      continue
    }

    const mensagem = resolverMensagem(proxMsg.mensagem, {
      nome: lead.nome ?? '', pilar_fraco: lead.pilar_fraco ?? '',
      data_reuniao: '', horario_reuniao: '', link_reuniao: '',
    })

    const { canalProvider, canalInstanceId } = await buscarCanal(supabase, fluxo.agente_id)
    await supabase.from('tarefas_agendadas').insert({
      lead_id: leadId, tipo: 'whatsapp_msg',
      payload: { texto: mensagem, agente_id: fluxo.agente_id, canal_provider: canalProvider, canal_instance_id: canalInstanceId },
      agendado_para: new Date().toISOString(), status: 'pendente',
    })
    await supabase.from('followup_enviados').insert({ followup_id: proxMsg.id, lead_id: leadId, agendamento_id: null })

    await supabase.from('followup_lead_estado').update({
      proxima_ordem: estado.proxima_ordem + 1,
      ultima_atividade: new Date().toISOString(),
    }).eq('lead_id', leadId)

    enviadas++
  }
  return enviadas
}

export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const [lembretes, reengajamento, interacao, entradas, estados] = await Promise.all([
    processarLembretes(supabase),
    processarReengajamento(supabase),
    processarDeteccaoInteracao(supabase),
    processarEntradaFluxos(supabase),
    processarEstados(supabase),
  ])

  return NextResponse.json({ lembretes, reengajamento, interacao, entradas, estados })
}

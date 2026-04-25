import { createAdminClient } from '@/lib/supabase/admin'
import { buildPrimeiraMsg, buildSystemPrompt, type EtapaPipeline } from '@/lib/agente/prompts'
import { createOpenAIClient, MODEL } from '@/lib/openai'
import { enviarMensagemInicialWhatsApp, enviarMensagemWhatsApp, enviarAudioViaMeta } from '@/lib/meta'
import { enviarViaBaileys, enviarAudioViaBaileys } from '@/lib/baileys'
import { getConfig } from '@/lib/config'
import { dispararWebhookSaida } from '@/lib/webhooks'
import { buscarSlotsComEscassez, formatarSlotsParaAgente, agendarParaLead, cancelarAgendamento } from '@/lib/agenda'
import { buildAgendamentoInstructions } from '@/lib/agente/prompts'
import type { CampoQualificacao, StatusLead } from '@/types/database'
import { createHash } from 'crypto'

interface AudioAgente { nome: string; url: string }

/** Extrai marcadores [[AUDIO:nome]] da resposta e retorna texto limpo + lista de URLs */
function extrairAudios(resposta: string, audios: AudioAgente[]): { texto: string; urls: string[] } {
  const urls: string[] = []
  const texto = resposta.replace(/\[\[AUDIO:([^\]]+)\]\]/g, (_, nome: string) => {
    const audio = audios.find(a => a.nome.toLowerCase() === nome.trim().toLowerCase())
    if (audio) urls.push(audio.url)
    return ''
  }).trim()
  return { texto, urls }
}

const CAMPOS_VALIDOS: CampoQualificacao[] = [
  'maior_dor', 'contexto', 'interesse', 'objecao', 'objetivo', 'urgencia', 'orcamento', 'outro',
]

const STATUS_VALIDOS: StatusLead[] = ['frio', 'morno', 'quente']

// Mapeamento automático de fase → pipeline_etapa (slugs fixos do sistema)
const FASE_PARA_ETAPA: Record<string, string> = {
  acolhimento:   'em_contato',
  sondagem:      'em_contato',
  proposta_call: 'proposta',
  link_enviado:  'proposta',
}

async function buscarEtapasPipeline(): Promise<EtapaPipeline[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createAdminClient() as any)
    .from('pipeline_etapas')
    .select('slug, label, is_final')
    .order('ordem')
  return (data ?? []) as EtapaPipeline[]
}

interface QualificacaoItem {
  campo: string
  valor: string
}

interface AgenteJSON {
  status_lead?: string
  fase?: string
  pipeline_etapa?: string
  enviar_link?: boolean
  qualificacoes?: QualificacaoItem[]
  // Agendamento automático / sequência
  acao?: 'buscar_disponibilidade' | 'confirmar_agendamento' | 'reagendar_agendamento' | 'cancelar_agendamento' | 'disparar_sequencia' | 'transferir_para_humano'
  email_lead?: string
  slot_data?: string    // YYYY-MM-DD
  slot_horario?: string // HH:MM
}

function parseAgenteJSON(texto: string, linkAgendamento?: string): { resposta: string; dados: AgenteJSON } {
  const separador = '---JSON---'
  let resposta = texto.trim()
  let dados: AgenteJSON = {}

  // Primário: separadores ---JSON---
  const partes = texto.split(separador)
  if (partes.length >= 3) {
    resposta = partes[0].trim()
    try {
      dados = JSON.parse(partes[1].trim()) as AgenteJSON
    } catch {
      dados = {}
    }
  } else {
    // Fallback: JSON cru no final da resposta (IA esqueceu os separadores)
    // Detecta o último bloco { ... } na mensagem e tenta parsear
    const jsonMatch = texto.match(/(\{[\s\S]*\})\s*$/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as AgenteJSON
        if (parsed.acao || parsed.status_lead || parsed.qualificacoes || parsed.email_lead) {
          dados = parsed
          resposta = texto.slice(0, texto.lastIndexOf(jsonMatch[1])).trim()
        }
      } catch { /* JSON inválido — mantém texto completo */ }
    }
  }

  if (!dados.enviar_link && linkAgendamento && resposta.includes(linkAgendamento)) {
    dados.enviar_link = true
    dados.fase = 'link_enviado'
  }

  return { resposta, dados }
}

export async function iniciarAgenteParaLead(leadId: string, force = false, agenteId?: string): Promise<{ ok: boolean; ignorado?: boolean; erroWhatsApp?: string }> {
  const supabase = createAdminClient()
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    throw new Error('Lead não encontrado')
  }

  // Verifica se já enviamos mensagem inicial (flag no lead)
  if (!force && lead.agente_iniciado) {
    return { ok: true, ignorado: true }
  }

  // Fallback: sem flag, verifica conversas (compatibilidade)
  if (!force && !lead.agente_iniciado) {
    const { count } = await supabase
      .from('conversas')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', leadId)
    if (count && count > 0) {
      return { ok: true, ignorado: true }
    }
  }

  const primeiraMsg = buildPrimeiraMsg(lead)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('conversas').insert({
    lead_id: leadId,
    role: 'assistant',
    mensagem: primeiraMsg,
    agente_id: agenteId ?? null,
  })

  // Marca que o agente foi iniciado para este lead
  await supabase.from('leads').update({ agente_iniciado: true }).eq('id', leadId)

  let erroWhatsApp: string | undefined
  if (lead.whatsapp) {
    // Tenta Baileys primeiro (sem restrição de janela 24h — ideal pós-resultado)
    let enviado = false
    try {
      await enviarViaBaileys(lead.whatsapp, primeiraMsg)
      enviado = true
    } catch {
      // fallback para Meta abaixo
    }

    if (!enviado) {
      try {
        await enviarMensagemInicialWhatsApp(lead.whatsapp, primeiraMsg, {
          nome: lead.nome,
          qs_total: lead.qs_total ?? 0,
          pilar_fraco: lead.pilar_fraco ?? 'Comunicação',
        })
      } catch (err) {
        erroWhatsApp = String(err)
        console.error('[agente] Falha ao enviar mensagem inicial via WhatsApp:', err)
      }
    }
  }

  return { ok: true, erroWhatsApp }
}

type CanalAgente = { provider: 'meta' | 'baileys'; instanceId?: string }

type AgenteConfig = {
  escassez_max_dias?: number
  escassez_max_slots?: number
  sequencia_msgs?: Array<{
    tipo?: 'text' | 'image' | 'audio' | 'video' | 'document'
    conteudo: string  // texto ou URL da mídia
    caption?: string
    filename?: string
  }>
  sequencia_delay_seg?: number
  sequencia_delay_inicial_seg?: number
  condicoes_transferencia?: string[]
}

type AgenteDB = {
  id: string
  nome: string
  prompt: string
  temperatura: number
  modelo: string
  ativo: boolean
  canais: Array<{ provider: string; id: string }>
  link_agendamento: string | null
  config?: AgenteConfig
}

async function buscarPessoaAgenda(agenteId: string): Promise<{ id: string; nome: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient() as any)
    .from('agenda_pessoas')
    .select('id, nome')
    .eq('agente_id', agenteId)
    .eq('ativo', true)
    .maybeSingle()
  if (error) console.error('[buscarPessoaAgenda] erro:', error.message, '— agenteId:', agenteId)
  if (!data) console.warn('[buscarPessoaAgenda] nenhuma agenda_pessoas ativa para agenteId:', agenteId)
  return data ?? null
}

// Busca o agente configurado para um canal específico
export async function encontrarAgentePorCanal(
  provider: 'meta' | 'baileys',
  instanceId?: string
): Promise<AgenteDB | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('agentes').select('*').eq('ativo', true)
  if (!data?.length) return null

  // 1ª passagem: match exato (instanceId bate com canal configurado)
  for (const ag of data) {
    const canais = (ag.canais || []) as Array<{ provider: string; id: string }>
    const match = canais.some(c =>
      c.provider === provider && (provider === 'meta' || c.id === instanceId)
    )
    if (match) return ag as AgenteDB
  }

  // 2ª passagem (Baileys apenas): fallback para qualquer agente com canal Baileys
  // Garante que todas as instâncias respondem mesmo sem ID exato configurado
  if (provider === 'baileys') {
    for (const ag of data) {
      const canais = (ag.canais || []) as Array<{ provider: string; id: string }>
      if (canais.some(c => c.provider === 'baileys')) return ag as AgenteDB
    }
  }

  // 3ª passagem: último recurso — usa o primeiro agente ativo independente de canal
  // Cobre o caso onde o agente existe mas não tem canais configurados explicitamente
  return data[0] as AgenteDB
}

export async function responderAgenteParaLead(
  leadId: string,
  mensagem: string,
  enviarWhatsApp = true,
  canal?: CanalAgente,
  agenteDB?: AgenteDB | null,
  extMessageId?: string
): Promise<{ ok: boolean; resposta: string }> {
  const supabase = createAdminClient()

  // Etapas do pipeline vindas do banco — permite customização sem deploy
  const etapasPipeline = await buscarEtapasPipeline()
  const etapaSlugsValidos = etapasPipeline.map(e => e.slug)

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    throw new Error('Lead não encontrado')
  }

  // ── Roteamento de agente ──────────────────────────────────────────────────
  // Prioridade: 1) agente passado explicitamente  2) agente fixo do lead  3) canal  4) default
  let agenteResolvido: AgenteDB | null = agenteDB ?? null

  // Se o lead tem um agente fixo e nenhum foi passado explicitamente, usa o fixo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadAny2 = lead as any
  if (!agenteResolvido && leadAny2.agente_id) {
    const { data: agenteFixo } = await (supabase as any)
      .from('agentes')
      .select('*')
      .eq('id', leadAny2.agente_id)
      .eq('ativo', true)
      .maybeSingle()
    if (agenteFixo) agenteResolvido = agenteFixo as AgenteDB
  }

  // Se ainda não tem agente e não há canal, tenta o agente padrão (recepcionista)
  if (!agenteResolvido && !canal) {
    const { data: agenteDefault } = await (supabase as any)
      .from('agentes')
      .select('*')
      .eq('ativo', true)
      .eq('is_default', true)
      .maybeSingle()
    if (agenteDefault) agenteResolvido = agenteDefault as AgenteDB
  }

  // Se lead sem agente_id recebe mensagem pelo canal, atribui o recepcionista ao lead
  if (!leadAny2.agente_id && agenteResolvido) {
    await (supabase as any)
      .from('leads')
      .update({ agente_id: agenteResolvido.id })
      .eq('id', leadId)
  }

  // Verifica agente ANTES de inserir mensagem para evitar queimar dedup sem resposta.
  if (agenteResolvido) {
    if (!agenteResolvido.ativo) return { ok: true, resposta: '' }
  } else {
    if (canal) return { ok: true, resposta: '' }
    const agenteAtivo = await getConfig('AGENT_ATIVO')
    if (agenteAtivo === 'false') return { ok: true, resposta: '' }
  }

  // Usa agente resolvido daqui em diante
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  agenteDB = agenteResolvido

  // ── Registra mensagem do lead com dedup ────────────────────────────────────
  // extMessageId (Meta) ou hash de conteúdo (Baileys sem ID padronizado).
  // UNIQUE em ext_message_id: segundo webhook da mesma mensagem retorna sem responder.
  const dedupId = extMessageId
    || createHash('sha256').update(`${leadId}:${mensagem}:${Math.floor(Date.now() / 30000)}`).digest('hex').slice(0, 40)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertMsgError } = await (supabase as any).from('conversas').insert({
    lead_id: leadId,
    role: 'user',
    mensagem,
    agente_id: agenteDB?.id ?? null,
    ext_message_id: dedupId,
  })
  if (insertMsgError?.code === '23505') {
    // Já processado (Meta re-entrega ou dois providers para o mesmo número)
    return { ok: true, resposta: '' }
  }

  // ── Pausa humana: registrou a mensagem mas o agente não responde ───────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadAny = lead as any
  if (leadAny.ultima_atividade_humana) {
    const diffMs = Date.now() - new Date(leadAny.ultima_atividade_humana as string).getTime()
    const CINCO_MIN = 5 * 60 * 1000
    if (diffMs < CINCO_MIN) {
      return { ok: true, resposta: '' } // humano está atendendo
    }
    // Pausa expirou: devolve controle à IA
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('leads')
      .update({ ultima_atividade_humana: null, etiqueta: 'ia_atendendo' })
      .eq('id', leadId)
  }

  // Transferência persistente para humano (sem expiração — acionada por agendamento ou config)
  // Diferente da pausa de 5 min (ultima_atividade_humana), esta só reverte quando o operador muda manualmente
  if ((lead as Record<string, unknown>).etiqueta === 'humano_atendendo') {
    return { ok: true, resposta: '' }
  }

  // Sequência em andamento: não responde enquanto há tarefas pendentes para este lead
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: tarefasPendentes } = await (supabase as any)
    .from('tarefas_agendadas')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('tipo', 'whatsapp_msg')
    .eq('status', 'pendente')
  if (tarefasPendentes && tarefasPendentes > 0) {
    return { ok: true, resposta: '' }
  }

  // Filtra histórico por agente_id quando há agente configurado — contextos separados por agente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let historicoQuery = (supabase as any)
    .from('conversas')
    .select('role, mensagem')
    .eq('lead_id', leadId)
    .order('criado_em', { ascending: true })
    .limit(20)
  if (agenteDB?.id) {
    historicoQuery = historicoQuery.eq('agente_id', agenteDB.id)
  }
  const { data: historico } = await historicoQuery

  // Config: agente DB tem prioridade sobre global
  const temperatura = agenteDB ? Number(agenteDB.temperatura) : parseFloat((await getConfig('AGENT_TEMPERATURE')) || '0.2')
  const modelo = agenteDB?.modelo || (await getConfig('AGENT_MODEL')) || MODEL
  const promptRaw = agenteDB?.prompt || (await getConfig('AGENT_SYSTEM_PROMPT')) || ''
  // Descobre o link de agendamento e dados da pessoa da agenda vinculada ao agente
  // Prioridade: 1) pessoa da agenda vinculada ao agente, 2) campo link_agendamento do agente, 3) config global
  let linkAgendamento = agenteDB?.link_agendamento || ''
  let pessoaNome: string | undefined
  let pessoaRole: string | undefined
  if (agenteDB?.id) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const { data: pessoaAgenda } = await (supabase as any)
      .from('agenda_pessoas')
      .select('slug, nome, role')
      .eq('agente_id', agenteDB.id)
      .eq('ativo', true)
      .single()
    if (pessoaAgenda) {
      if (!linkAgendamento && pessoaAgenda.slug) {
        linkAgendamento = `${appUrl}/agendar/${pessoaAgenda.slug}`
      }
      pessoaNome = pessoaAgenda.nome || undefined
      pessoaRole = pessoaAgenda.role || undefined
    }
  }
  if (!linkAgendamento) {
    linkAgendamento = (await getConfig('LINK_AGENDAMENTO')) || ''
  }

  // Carrega áudios configurados para este agente
  let audiosAgente: AudioAgente[] = []
  if (agenteDB?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: audiosDB } = await (supabase as any)
      .from('agente_audios')
      .select('nome, url')
      .eq('agente_id', agenteDB.id)
    audiosAgente = (audiosDB ?? []) as AudioAgente[]
  }
  // Verifica agendamento confirmado diretamente na tabela — independente do Kanban
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: agendamentosConfirmados } = await (supabase as any)
    .from('agenda_agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('status', 'confirmado')
  const jaAgendado = (agendamentosConfirmados ?? 0) > 0

  const promptBase = promptRaw
    ? promptRaw
        .replace(/\{\{nome\}\}/g, lead.nome)
        .replace(/\{\{pilar\}\}/g, lead.pilar_fraco ?? 'Comunicação')
        .replace(/\{\{link_agendamento\}\}/g, linkAgendamento)
        .replace(/\{\{pessoa_nome\}\}/g, pessoaNome ?? '')
        .replace(/\{\{pessoa_role\}\}/g, pessoaRole ?? '')
    : buildSystemPrompt(lead, linkAgendamento, pessoaNome, pessoaRole, etapasPipeline, jaAgendado)

  // Sempre injeta o protocolo de agendamento ao final — garante regras críticas
  // mesmo quando o prompt customizado já tem instruções de agendamento.
  // Não duplica o bloco JSON: remove qualquer ---JSON--- existente do promptBase antes de injetar.
  const agendamentoBlock = buildAgendamentoInstructions(linkAgendamento, pessoaNome, pessoaRole, etapasPipeline, agenteDB?.config?.condicoes_transferencia, jaAgendado)
  const promptSemJson = promptBase.replace(/---JSON---[\s\S]*?---JSON---/g, '').trimEnd()
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
  const systemPrompt = `DATA ATUAL: ${dataHoje}\n\n${promptSemJson}\n${agendamentoBlock}`

  const mensagensOpenAI: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  if (historico) {
    for (const msg of historico) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        mensagensOpenAI.push({ role: msg.role, content: msg.mensagem })
      }
    }
  }
  mensagensOpenAI.push({ role: 'user', content: mensagem })

  await dispararWebhookSaida('mensagem_recebida', {
    lead_id: lead.id,
    nome: lead.nome,
    email: lead.email,
    whatsapp: lead.whatsapp,
    mensagem,
  })

  const openai = await createOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: modelo,
    messages: mensagensOpenAI,
    temperature: temperatura,
    max_tokens: 600,
  })

  const respostaCompleta = completion.choices[0]?.message?.content ?? ''
  const { texto: respostaSemAudio, urls: audioUrls } = extrairAudios(respostaCompleta, audiosAgente)
  let { resposta, dados } = parseAgenteJSON(respostaSemAudio, linkAgendamento)

  // ── Ação: buscar disponibilidade e re-chamar IA com slots filtrados ─────────
  if (dados.acao === 'buscar_disponibilidade') {
    const pessoaAgenda = agenteDB?.id ? await buscarPessoaAgenda(agenteDB.id) : null
    if (pessoaAgenda) {
      const agConfig = agenteDB?.config ?? {}
      const dias = await buscarSlotsComEscassez(pessoaAgenda.id, {
        maxDias:  agConfig.escassez_max_dias,
        maxSlots: agConfig.escassez_max_slots,
      })
      const slotsTexto = formatarSlotsParaAgente(dias)
      const mensagensComSlots: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        ...mensagensOpenAI,
        { role: 'assistant', content: respostaCompleta },
        { role: 'system', content: `SLOTS DISPONÍVEIS (use APENAS esses, nunca invente outros):\n${slotsTexto}\n\nApresente ao lead de forma natural com urgência e escassez. Não mostre quantos horários há no total — apenas os que estão aqui.` },
      ]
      const comp2 = await openai.chat.completions.create({ model: modelo, messages: mensagensComSlots, temperature: temperatura, max_tokens: 300 })
      const raw2 = comp2.choices[0]?.message?.content ?? ''
      const { texto: sem2 } = extrairAudios(raw2, audiosAgente)
      const parsed2 = parseAgenteJSON(sem2, linkAgendamento)
      resposta = parsed2.resposta || raw2
      dados = { ...dados, ...parsed2.dados }
    }
  }

  // ── Ação: confirmar agendamento diretamente ──────────────────────────────────
  if (dados.acao === 'confirmar_agendamento' && dados.slot_data && dados.slot_horario) {
    console.log('[agente] confirmar_agendamento detectado:', {
      slot_data: dados.slot_data,
      slot_horario: dados.slot_horario,
      email_lead: dados.email_lead,
      agenteId: agenteDB?.id ?? 'sem agente',
    })

    const pessoaAgenda = agenteDB?.id ? await buscarPessoaAgenda(agenteDB.id) : null
    if (!pessoaAgenda) {
      console.error('[agente] confirmar_agendamento: nenhuma agenda_pessoas vinculada ao agente', agenteDB?.id)
      // Booking impossível — não enviar resposta falsa de "agendado"
      return { ok: false, resposta: 'Tive um problema técnico ao confirmar o horário. Pode me informar novamente qual dia e horário você prefere?' }
    }

    // Valida se o slot realmente existe na disponibilidade real (evita datas inventadas pela IA)
    const agConfig = agenteDB?.config ?? {}
    const diasReais = await buscarSlotsComEscassez(pessoaAgenda.id, {
      maxDias: 14,
      maxSlots: agConfig.escassez_max_slots ?? 8,
    })
    const diaReal = diasReais.find(d => d.data === dados.slot_data)
    if (!diaReal) {
      // Slot não existe mais — reapresenta horários reais sem mencionar o problema
      const slotsTexto = diasReais.length > 0
        ? formatarSlotsParaAgente(diasReais)
        : 'Não há horários disponíveis nos próximos dias.'
      console.warn('[agente] confirmar_agendamento: data inválida:', dados.slot_data, '— re-chamando IA com slots reais')
      const msgCorrecao: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        ...mensagensOpenAI,
        { role: 'assistant', content: respostaCompleta },
        { role: 'system', content: `O horário indicado não pôde ser confirmado. Apresente estes horários reais disponíveis e peça ao lead para escolher um — sem mencionar que houve qualquer problema:\n${slotsTexto}` },
      ]
      const comp3 = await openai.chat.completions.create({ model: modelo, messages: msgCorrecao, temperature: temperatura, max_tokens: 300 })
      const raw3 = comp3.choices[0]?.message?.content ?? ''
      const { texto: sem3 } = extrairAudios(raw3, audiosAgente)
      resposta = parseAgenteJSON(sem3, linkAgendamento).resposta || raw3
      dados.acao = undefined
    } else {
      const emailLead = dados.email_lead || (lead as Record<string, unknown>).email as string || ''
      console.log('[agente] chamando agendarParaLead:', { pessoaId: pessoaAgenda.id, data: dados.slot_data, horario: dados.slot_horario, emailLead })
      try {
        await agendarParaLead({
          pessoaId: pessoaAgenda.id,
          data: dados.slot_data,
          horario: dados.slot_horario,
          nomeCliente: lead.nome,
          emailCliente: emailLead,
          whatsCliente: lead.whatsapp ?? '',
          leadId,
          agenteId: agenteDB?.id ?? null,
          canalProvider: canal?.provider,
          canalInstanciaId: canal?.instanceId,
        })
        // Agendamento gravado com sucesso — transfere para humano e retorna
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('leads').update({ etiqueta: 'humano_atendendo' }).eq('id', leadId)
        return { ok: true, resposta: resposta || 'Agendamento confirmado!' }
      } catch (err) {
        console.error('[agente] Falha ao agendar:', err)
        // Não enviar a resposta falsa "agendei" — o agendamento NÃO foi salvo
        return { ok: false, resposta: 'Tive um problema técnico ao confirmar o horário. Pode me informar novamente qual dia e horário você prefere?' }
      }
    }
  }

  // ── Ação: reagendar agendamento ──────────────────────────────────────────────
  if (dados.acao === 'reagendar_agendamento') {
    const pessoaAgenda = agenteDB?.id ? await buscarPessoaAgenda(agenteDB.id) : null
    if (pessoaAgenda) {
      // Cancela agendamento atual e busca novos slots
      await cancelarAgendamento(leadId, pessoaAgenda.id)
      const agConfig = agenteDB?.config ?? {}
      const dias = await buscarSlotsComEscassez(pessoaAgenda.id, {
        maxDias: agConfig.escassez_max_dias,
        maxSlots: agConfig.escassez_max_slots,
      })
      const slotsTexto = formatarSlotsParaAgente(dias)
      const msgReagendar: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        ...mensagensOpenAI,
        { role: 'assistant', content: respostaCompleta },
        { role: 'system', content: `O agendamento anterior foi cancelado. Apresente estes novos horários disponíveis ao lead:\n${slotsTexto}` },
      ]
      const compR = await openai.chat.completions.create({ model: modelo, messages: msgReagendar, temperature: temperatura, max_tokens: 300 })
      const rawR = compR.choices[0]?.message?.content ?? ''
      const { texto: semR } = extrairAudios(rawR, audiosAgente)
      resposta = parseAgenteJSON(semR, linkAgendamento).resposta || rawR
      dados.acao = undefined
    }
  }

  // ── Ação: cancelar agendamento ────────────────────────────────────────────────
  if (dados.acao === 'cancelar_agendamento') {
    const pessoaAgenda = agenteDB?.id ? await buscarPessoaAgenda(agenteDB.id) : null
    if (pessoaAgenda) {
      const cancelou = await cancelarAgendamento(leadId, pessoaAgenda.id)
      if (cancelou) {
        // Tenta convencer a remarcar em vez de só cancelar
        const agConfig = agenteDB?.config ?? {}
        const dias = await buscarSlotsComEscassez(pessoaAgenda.id, {
          maxDias: agConfig.escassez_max_dias,
          maxSlots: agConfig.escassez_max_slots,
        })
        const slotsTexto = dias.length > 0 ? formatarSlotsParaAgente(dias) : ''
        const instrucao = slotsTexto
          ? `O agendamento foi cancelado. Valide a decisão do lead com empatia e ofereça remarcar para um desses horários:\n${slotsTexto}`
          : 'O agendamento foi cancelado. Confirme com empatia e deixe a porta aberta para remarcar futuramente.'
        const msgCancel: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          ...mensagensOpenAI,
          { role: 'assistant', content: respostaCompleta },
          { role: 'system', content: instrucao },
        ]
        const compC = await openai.chat.completions.create({ model: modelo, messages: msgCancel, temperature: temperatura, max_tokens: 300 })
        const rawC = compC.choices[0]?.message?.content ?? ''
        const { texto: semC } = extrairAudios(rawC, audiosAgente)
        resposta = parseAgenteJSON(semC, linkAgendamento).resposta || rawC
        dados.acao = undefined
      }
    }
  }

  // Flag: dispara o cron APÓS o envio WhatsApp, garantindo que a resposta do agente chega primeiro
  let triggerCronSequencia = false

  // ── Ação: disparar sequência configurada no agente ───────────────────────────
  if (dados.acao === 'disparar_sequencia') {
    const msgs = agenteDB?.config?.sequencia_msgs ?? []
    if (msgs.length > 0) {
      const delaySeg = agenteDB?.config?.sequencia_delay_seg ?? 30
      const delayInicialSeg = agenteDB?.config?.sequencia_delay_inicial_seg ?? 0
      const agora = Date.now()

      // Dedup: evita race condition e re-disparo da IA na mesma conversa.
      // Usa agendado_para como proxy de quando a tarefa foi criada
      // (agendado_para = now + poucos segundos → janela de 5 min é segura)
      const cincoMin = new Date(agora - 5 * 60 * 1000).toISOString()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: jaDisparou } = await (supabase as any)
        .from('tarefas_agendadas')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId)
        .eq('tipo', 'whatsapp_msg')
        .neq('status', 'cancelada')
        .gte('agendado_para', cincoMin)

      if (!jaDisparou) {
        // Canal: usa o da conversa atual; fallback para o primeiro canal configurado no agente
        const seqProvider = canal?.provider
          ?? (agenteDB?.canais?.[0]?.provider as 'meta' | 'baileys' | undefined)
          ?? 'meta'
        const seqInstanceId = canal?.instanceId
          ?? agenteDB?.canais?.[0]?.id
          ?? null

        // Cancela sequências anteriores pendentes antes de criar novas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('tarefas_agendadas')
          .update({ status: 'cancelada' })
          .eq('lead_id', leadId)
          .eq('tipo', 'whatsapp_msg')
          .eq('status', 'pendente')

        for (let i = 0; i < msgs.length; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('tarefas_agendadas').insert({
            lead_id: leadId,
            tipo: 'whatsapp_msg',
            payload: {
              tipo: msgs[i].tipo ?? 'text',
              conteudo: msgs[i].conteudo,
              ...(msgs[i].caption ? { caption: msgs[i].caption } : {}),
              ...(msgs[i].filename ? { filename: msgs[i].filename } : {}),
              agente_id: agenteDB?.id ?? null,
              canal_provider: seqProvider,
              canal_instance_id: seqInstanceId,
            },
            agendado_para: new Date(agora + delayInicialSeg * 1000 + i * delaySeg * 1000).toISOString(),
            status: 'pendente',
          })
        }
        // Cron disparado APÓS o envio WhatsApp — garante que "Maravilha" chega antes do disparo
        triggerCronSequencia = true
      }
    }
  }

  // ── Ação: transferir para atendimento humano ────────────────────────────────
  if (dados.acao === 'transferir_para_humano') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('leads').update({ etiqueta: 'humano_atendendo' }).eq('id', leadId)
  }

  // ── Transferência para outro agente IA ──────────────────────────────────────
  // O prompt do recepcionista pode incluir [TRANSFERIR:uuid-do-agente] para redirecionar o lead.
  // O sistema detecta, atualiza lead.agente_id e remove o marcador da resposta enviada.
  const matchTransfer = resposta.match(/\[TRANSFERIR:([a-f0-9-]{36})\]/i)
  if (matchTransfer) {
    const novoAgenteId = matchTransfer[1]
    resposta = resposta.replace(matchTransfer[0], '').trim()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('leads')
      .update({ agente_id: novoAgenteId })
      .eq('id', leadId)
    console.log(`[agente] Lead ${leadId} transferido para agente ${novoAgenteId}`)
  }

  const respostaImediata = resposta

  // Dedup: evita inserir a mesma mensagem imediata duas vezes (webhook duplo)
  const doisMin = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: jaRegistrado } = await (supabase as any)
    .from('conversas')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('role', 'assistant')
    .eq('mensagem', respostaImediata)
    .gte('criado_em', doisMin)
  if (!jaRegistrado) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('conversas').insert({
      lead_id: leadId,
      role: 'assistant',
      mensagem: respostaImediata,
      agente_id: agenteDB?.id ?? null,
    })
  }

  if (dados.qualificacoes && dados.qualificacoes.length > 0) {
    const qualificacoesParaSalvar = dados.qualificacoes
      .filter((q) => q.campo && q.valor && CAMPOS_VALIDOS.includes(q.campo as CampoQualificacao))
      .map((q) => ({
        lead_id: leadId,
        campo: q.campo as CampoQualificacao,
        valor: q.valor,
      }))

    if (qualificacoesParaSalvar.length > 0) {
      await supabase.from('qualificacoes').insert(qualificacoesParaSalvar)
    }
  }

  if (
    dados.status_lead &&
    dados.status_lead !== lead.status_lead &&
    STATUS_VALIDOS.includes(dados.status_lead as StatusLead)
  ) {
    await supabase
      .from('leads')
      .update({ status_lead: dados.status_lead as StatusLead })
      .eq('id', leadId)

    await dispararWebhookSaida('status_atualizado', {
      lead_id: lead.id,
      status_anterior: lead.status_lead,
      status_atual: dados.status_lead,
    })
  }

  // Avança etapa do pipeline automaticamente
  const etapaExplicita = dados.pipeline_etapa && etapaSlugsValidos.includes(dados.pipeline_etapa)
    ? dados.pipeline_etapa
    : dados.fase ? FASE_PARA_ETAPA[dados.fase] : undefined

  if (etapaExplicita) {
    const etapaAtual = (lead as Record<string, unknown>).pipeline_etapa as string | undefined
    // Só avança, nunca regride (exceto etapas is_final que sempre podem ser definidas)
    const idxAtual = etapaSlugsValidos.indexOf(etapaAtual ?? 'novo')
    const idxNova = etapaSlugsValidos.indexOf(etapaExplicita)
    const finaliza = etapasPipeline.find(e => e.slug === etapaExplicita)?.is_final ?? false
    if (finaliza || idxNova > idxAtual) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('leads')
        .update({ pipeline_etapa: etapaExplicita })
        .eq('id', leadId)
    }
  }

  // Quando o agente enviar o link de agendamento, marcar o lead como aguardando agendamento
  if (dados.enviar_link) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('leads')
      .update({ etiqueta: 'aguardando_agendamento' })
      .eq('id', leadId)

    await dispararWebhookSaida('link_agendamento_enviado', {
      lead_id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
    })
  }

  if (enviarWhatsApp && lead.whatsapp) {
    try {
      // Envia texto (se houver)
      if (resposta) {
        if (canal?.provider === 'baileys') {
          await enviarViaBaileys(lead.whatsapp, resposta, canal.instanceId)
        } else {
          await enviarMensagemWhatsApp(lead.whatsapp, resposta)
        }
      }

      // Envia áudios extraídos do marcador [[AUDIO:nome]]
      for (const audioUrl of audioUrls) {
        if (canal?.provider === 'baileys') {
          await enviarAudioViaBaileys(lead.whatsapp, audioUrl, canal.instanceId)
        } else {
          await enviarAudioViaMeta(lead.whatsapp, audioUrl)
        }
      }
    } catch (err) {
      console.error('[agente] Falha ao enviar resposta via WhatsApp:', err)
    }
  }

  // Dispara o cron DEPOIS do envio WhatsApp — garante que "Maravilha [nome]" chega antes do disparo
  if (triggerCronSequencia) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const cronSecret = process.env.CRON_SECRET ? `?secret=${process.env.CRON_SECRET}` : ''
    fetch(`${appUrl}/api/cron/processar-tarefas${cronSecret}`, { method: 'POST' }).catch(() => {})
  }

  return { ok: true, resposta }
}

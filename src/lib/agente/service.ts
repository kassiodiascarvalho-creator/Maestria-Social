import { createAdminClient } from '@/lib/supabase/admin'
import { buildPrimeiraMsg, buildSystemPrompt } from '@/lib/agente/prompts'
import { createOpenAIClient, MODEL } from '@/lib/openai'
import { enviarMensagemInicialWhatsApp, enviarMensagemWhatsApp, enviarAudioViaMeta } from '@/lib/meta'
import { enviarViaBaileys, enviarAudioViaBaileys } from '@/lib/baileys'
import { getConfig } from '@/lib/config'
import { dispararWebhookSaida } from '@/lib/webhooks'
import type { CampoQualificacao, StatusLead } from '@/types/database'

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
const ETAPAS_VALIDAS = ['novo', 'em_contato', 'qualificado', 'proposta', 'agendado', 'convertido', 'perdido']

// Mapeamento automático de fase → pipeline_etapa
const FASE_PARA_ETAPA: Record<string, string> = {
  acolhimento:   'em_contato',
  sondagem:      'em_contato',
  proposta_call: 'proposta',
  link_enviado:  'proposta',
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
}

function parseAgenteJSON(texto: string, linkAgendamento?: string): { resposta: string; dados: AgenteJSON } {
  const separador = '---JSON---'
  const partes = texto.split(separador)

  let resposta = texto.trim()
  let dados: AgenteJSON = {}

  if (partes.length >= 3) {
    resposta = partes[0].trim()
    try {
      dados = JSON.parse(partes[1].trim()) as AgenteJSON
    } catch {
      dados = {}
    }
  }

  // Detecta automaticamente se o link de agendamento está na resposta
  // independente do que o modelo retornou no JSON
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

type AgenteDB = {
  id: string
  nome: string
  prompt: string
  temperatura: number
  modelo: string
  ativo: boolean
  canais: Array<{ provider: string; id: string }>
  link_agendamento: string | null
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

  for (const ag of data) {
    const canais = (ag.canais || []) as Array<{ provider: string; id: string }>
    const match = canais.some(c =>
      c.provider === provider && (provider === 'meta' || c.id === instanceId)
    )
    if (match) return ag as AgenteDB
  }
  return null
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

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    throw new Error('Lead não encontrado')
  }

  // Salva mensagem do lead SEMPRE — independente de o agente responder ou não.
  // ext_message_id tem índice UNIQUE: se o mesmo webhook chegar duas vezes (Meta re-entrega),
  // o insert falha silenciosamente e o agente não responde duplicado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertMsgError } = await (supabase as any).from('conversas').insert({
    lead_id: leadId,
    role: 'user',
    mensagem,
    agente_id: agenteDB?.id ?? null,
    ext_message_id: extMessageId ?? null,
  })
  if (insertMsgError?.code === '23505') {
    // Evento já processado (webhook duplicado) — ignora silenciosamente
    return { ok: true, resposta: '' }
  }

  // Regra de pausa: se um humano enviou mensagem nos últimos 5 minutos, o agente não responde
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadAny = lead as any
  if (leadAny.ultima_atividade_humana) {
    const diffMs = Date.now() - new Date(leadAny.ultima_atividade_humana as string).getTime()
    const CINCO_MIN = 5 * 60 * 1000
    if (diffMs < CINCO_MIN) {
      return { ok: true, resposta: '' } // agente em pausa — humano está atendendo
    }
    // Pausa expirou: retorna etiqueta para 'ia_atendendo'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('leads')
      .update({ ultima_atividade_humana: null, etiqueta: 'ia_atendendo' })
      .eq('id', leadId)
  }

  // Se veio de agente DB: usa config dele; senão usa config global (compat)
  if (agenteDB) {
    if (!agenteDB.ativo) return { ok: true, resposta: '' }
  } else {
    const agenteAtivo = await getConfig('AGENT_ATIVO')
    if (agenteAtivo === 'false') return { ok: true, resposta: '' }

    // Fallback: verifica AGENT_CANAIS global se não há agente DB
    if (canal) {
      const canaisRaw = await getConfig('AGENT_CANAIS')
      if (canaisRaw) {
        try {
          const canais: Array<{ provider: string; id: string }> = JSON.parse(canaisRaw)
          const canalAtivo = canais.some(c =>
            c.provider === canal.provider &&
            (canal.provider === 'meta' || c.id === canal.instanceId)
          )
          if (!canalAtivo) return { ok: true, resposta: '' }
        } catch { /* ignora */ }
      }
    }
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
  const systemPrompt = promptRaw
    ? promptRaw
        .replace(/\{\{nome\}\}/g, lead.nome)
        .replace(/\{\{pilar\}\}/g, lead.pilar_fraco ?? 'Comunicação')
        .replace(/\{\{link_agendamento\}\}/g, linkAgendamento)
        .replace(/\{\{pessoa_nome\}\}/g, pessoaNome ?? '')
        .replace(/\{\{pessoa_role\}\}/g, pessoaRole ?? '')
    : buildSystemPrompt(lead, linkAgendamento, pessoaNome, pessoaRole)

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
  // Extrai marcadores [[AUDIO:nome]] antes de fazer o parseAgenteJSON
  const { texto: respostaSemAudio, urls: audioUrls } = extrairAudios(respostaCompleta, audiosAgente)
  const { resposta, dados } = parseAgenteJSON(respostaSemAudio, linkAgendamento)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('conversas').insert({
    lead_id: leadId,
    role: 'assistant',
    mensagem: resposta,
    agente_id: agenteDB?.id ?? null,
  })

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
  const etapaExplicita = dados.pipeline_etapa && ETAPAS_VALIDAS.includes(dados.pipeline_etapa)
    ? dados.pipeline_etapa
    : dados.fase ? FASE_PARA_ETAPA[dados.fase] : undefined

  if (etapaExplicita) {
    const etapaAtual = (lead as Record<string, unknown>).pipeline_etapa as string | undefined
    // Só avança, nunca regride (exceto para perdido/convertido que são finais)
    const ordemEtapas = ETAPAS_VALIDAS
    const idxAtual = ordemEtapas.indexOf(etapaAtual ?? 'novo')
    const idxNova = ordemEtapas.indexOf(etapaExplicita)
    const finaliza = etapaExplicita === 'perdido' || etapaExplicita === 'convertido'
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

  return { ok: true, resposta }
}

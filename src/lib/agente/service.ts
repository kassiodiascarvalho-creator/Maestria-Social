import { createAdminClient } from '@/lib/supabase/admin'
import { buildPrimeiraMsg, buildSystemPrompt } from '@/lib/agente/prompts'
import { createOpenAIClient, MODEL } from '@/lib/openai'
import { enviarMensagemInicialWhatsApp, enviarMensagemWhatsApp } from '@/lib/meta'
import { getConfig } from '@/lib/config'
import { dispararWebhookSaida } from '@/lib/webhooks'
import type { CampoQualificacao, StatusLead } from '@/types/database'

const CAMPOS_VALIDOS: CampoQualificacao[] = [
  'maior_dor', 'contexto', 'interesse', 'objecao', 'objetivo', 'urgencia', 'orcamento', 'outro',
]

const STATUS_VALIDOS: StatusLead[] = ['frio', 'morno', 'quente']

interface QualificacaoItem {
  campo: string
  valor: string
}

interface AgenteJSON {
  status_lead?: string
  qualificacoes?: QualificacaoItem[]
}

function parseAgenteJSON(texto: string): { resposta: string; dados: AgenteJSON } {
  const separador = '---JSON---'
  const partes = texto.split(separador)

  if (partes.length < 3) {
    return { resposta: texto.trim(), dados: {} }
  }

  const resposta = partes[0].trim()
  const jsonBruto = partes[1].trim()

  try {
    const dados = JSON.parse(jsonBruto) as AgenteJSON
    return { resposta, dados }
  } catch {
    return { resposta, dados: {} }
  }
}

export async function iniciarAgenteParaLead(leadId: string): Promise<{ ok: boolean; ignorado?: boolean }> {
  const supabase = createAdminClient()
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    throw new Error('Lead não encontrado')
  }

  const { count } = await supabase
    .from('conversas')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)

  if (count && count > 0) {
    return { ok: true, ignorado: true }
  }

  const primeiraMsg = buildPrimeiraMsg(lead)

  await supabase.from('conversas').insert({
    lead_id: leadId,
    role: 'assistant',
    mensagem: primeiraMsg,
  })

  if (lead.whatsapp) {
    await enviarMensagemInicialWhatsApp(lead.whatsapp, primeiraMsg)
  }

  return { ok: true }
}

export async function responderAgenteParaLead(
  leadId: string,
  mensagem: string,
  enviarWhatsApp = true
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

  const agenteAtivo = await getConfig('AGENT_ATIVO')
  if (agenteAtivo === 'false') {
    return { ok: true, resposta: '' }
  }

  const { data: historico } = await supabase
    .from('conversas')
    .select('role, mensagem')
    .eq('lead_id', leadId)
    .order('criado_em', { ascending: true })
    .limit(20)

  const promptCustom = await getConfig('AGENT_SYSTEM_PROMPT')
  const tempConfig = await getConfig('AGENT_TEMPERATURE')
  const modeloConfig = await getConfig('AGENT_MODEL')
  const temperatura = tempConfig ? parseFloat(tempConfig) : 0.2
  const modelo = modeloConfig || MODEL
  const systemPrompt = promptCustom
    ? promptCustom.replace('{{nome}}', lead.nome).replace('{{pilar}}', lead.pilar_fraco ?? 'Comunicação')
    : buildSystemPrompt(lead)

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

  await supabase.from('conversas').insert({
    lead_id: leadId,
    role: 'user',
    mensagem,
  })

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
  const { resposta, dados } = parseAgenteJSON(respostaCompleta)

  await supabase.from('conversas').insert({
    lead_id: leadId,
    role: 'assistant',
    mensagem: resposta,
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

  if (enviarWhatsApp && lead.whatsapp && resposta) {
    await enviarMensagemWhatsApp(lead.whatsapp, resposta)
  }

  return { ok: true, resposta }
}

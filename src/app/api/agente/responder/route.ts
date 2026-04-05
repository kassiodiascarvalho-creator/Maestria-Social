import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOpenAIClient, MODEL } from '@/lib/openai'
import { buildSystemPrompt } from '@/lib/agente/prompts'
import { enviarMensagemWhatsApp } from '@/lib/meta'
import { getConfig } from '@/lib/config'
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id, mensagem } = body as { lead_id?: string; mensagem?: string }

    if (!lead_id || !mensagem) {
      return NextResponse.json({ error: 'lead_id e mensagem são obrigatórios' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Buscar dados do lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Buscar histórico de conversas
    const { data: historico } = await supabase
      .from('conversas')
      .select('role, mensagem')
      .eq('lead_id', lead_id)
      .order('criado_em', { ascending: true })
      .limit(20)

    // Verificar se agente está ativo
    const agenteAtivo = await getConfig('AGENT_ATIVO')
    if (agenteAtivo === 'false') {
      return NextResponse.json({ ok: true, ignorado: true })
    }

    // Buscar prompt e temperatura configuráveis
    const promptCustom = await getConfig('AGENT_SYSTEM_PROMPT')
    const tempConfig = await getConfig('AGENT_TEMPERATURE')
    const temperatura = tempConfig ? parseFloat(tempConfig) : 0.2
    const systemPrompt = promptCustom
      ? promptCustom.replace('{{nome}}', lead.nome).replace('{{pilar}}', lead.pilar_fraco ?? 'Comunicação')
      : buildSystemPrompt(lead)

    // Montar array de mensagens para OpenAI
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

    // Salvar mensagem do usuário no histórico
    await supabase.from('conversas').insert({
      lead_id,
      role: 'user' as const,
      mensagem,
    })

    // Chamar OpenAI
    const openai = await createOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: mensagensOpenAI,
      temperature: temperatura,
      max_tokens: 600,
    })

    const respostaCompleta = completion.choices[0]?.message?.content ?? ''
    const { resposta, dados } = parseAgenteJSON(respostaCompleta)

    // Salvar resposta do assistente
    await supabase.from('conversas').insert({
      lead_id,
      role: 'assistant' as const,
      mensagem: resposta,
    })

    // Salvar qualificações extraídas
    if (dados.qualificacoes && dados.qualificacoes.length > 0) {
      const qualificacoesParaSalvar = dados.qualificacoes
        .filter((q) => q.campo && q.valor && CAMPOS_VALIDOS.includes(q.campo as CampoQualificacao))
        .map((q) => ({
          lead_id,
          campo: q.campo as CampoQualificacao,
          valor: q.valor,
        }))

      if (qualificacoesParaSalvar.length > 0) {
        await supabase.from('qualificacoes').insert(qualificacoesParaSalvar)
      }
    }

    // Atualizar status do lead se mudou
    if (
      dados.status_lead &&
      dados.status_lead !== lead.status_lead &&
      STATUS_VALIDOS.includes(dados.status_lead as StatusLead)
    ) {
      await supabase
        .from('leads')
        .update({ status_lead: dados.status_lead as StatusLead })
        .eq('id', lead_id)
    }

    // Enviar resposta via WhatsApp
    if (lead.whatsapp) {
      const telefoneFormatado = lead.whatsapp.replace(/\D/g, '')
      const telefoneFull = telefoneFormatado.startsWith('55')
        ? telefoneFormatado
        : `55${telefoneFormatado}`

      await enviarMensagemWhatsApp(telefoneFull, resposta)
    }

    return NextResponse.json({ ok: true, resposta })
  } catch (err) {
    console.error('[agente/responder]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

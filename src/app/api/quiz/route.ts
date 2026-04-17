import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { iniciarAgenteParaLead } from '@/lib/agente/service'
import { dispararWebhookSaida } from '@/lib/webhooks'
import { agendarVarias, emDias, emMinutos } from '@/lib/tarefas/agendar'
import type { ScoresPilares, NivelQS } from '@/types/database'

const PILARES = ['A', 'B', 'C', 'D', 'E'] as const
const NOMES_PILARES: Record<string, string> = {
  A: 'Sociabilidade',
  B: 'Comunicação',
  C: 'Relacionamento',
  D: 'Persuasão',
  E: 'Influência',
}

function calcularNivel(total: number): NivelQS {
  if (total <= 100) return 'Negligente'
  if (total <= 150) return 'Iniciante'
  if (total <= 200) return 'Intermediário'
  if (total <= 225) return 'Avançado'
  return 'Mestre'
}

function calcularPilarFraco(scores: ScoresPilares): string {
  let menor = Infinity
  let pilar = 'A'
  for (const p of PILARES) {
    if (scores[p] < menor) {
      menor = scores[p]
      pilar = p
    }
  }
  return NOMES_PILARES[pilar]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id, scores } = body

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 })
    }

    // Valida estrutura dos scores
    if (!scores || typeof scores !== 'object') {
      return NextResponse.json({ error: 'scores inválidos' }, { status: 400 })
    }
    for (const p of PILARES) {
      const v = scores[p]
      if (typeof v !== 'number' || v < 10 || v > 50) {
        return NextResponse.json(
          { error: `Score do pilar ${p} inválido (esperado: 10–50)` },
          { status: 400 }
        )
      }
    }

    const typedScores = scores as ScoresPilares
    const qs_total = PILARES.reduce((sum, p) => sum + typedScores[p], 0)
    const qs_percentual = Math.round((qs_total / 250) * 100)
    const nivel_qs = calcularNivel(qs_total)
    const pilar_fraco = calcularPilarFraco(typedScores)

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('leads')
      .update({ qs_total, qs_percentual, scores: typedScores, nivel_qs, pilar_fraco })
      .eq('id', lead_id)

    if (error) throw error

    await dispararWebhookSaida('lead_qualificado', {
      lead_id,
      qs_total,
      qs_percentual,
      nivel_qs,
      pilar_fraco,
      scores: typedScores,
    })

    try {
      // force=true: sempre envia mensagem inicial ao finalizar quiz,
      // mesmo que o lead já tenha conversas de sessões anteriores
      await iniciarAgenteParaLead(lead_id, true)
    } catch (e) {
      console.error('[quiz] erro ao iniciar agente:', e)
    }

    // Cancela qualquer recuperação de quiz pendente (lead concluiu)
    try {
      await supabase
        .from('tarefas_agendadas')
        .update({ status: 'cancelada' })
        .eq('lead_id', lead_id)
        .eq('tipo', 'recuperacao_quiz')
        .eq('status', 'pendente')
    } catch (e) {
      console.error('[quiz] erro ao cancelar recuperação:', e)
    }

    // Ações 3 + 5: funil de emails (D+0..D+7) + follow-ups WhatsApp segmentados por pilar
    try {
      // Mensagens WhatsApp por pilar — focadas na dor específica de cada sub-avatar
      const wppPorPilar: Record<string, [string, string, string]> = {
        Sociabilidade: [
          `Oi {nome}! Uma pergunta rápida: quando você está num ambiente com pessoas que não conhece, o que acontece internamente? Quero entender melhor sua situação.`,
          `{nome}, a maioria das pessoas com dificuldade de iniciar conexões não sabe que o problema não é timidez — é ausência de método. Posso te mostrar o primeiro passo?`,
          `{nome}, você ainda pensa naquele resultado? {qs_percentual}/100 em Sociabilidade significa oportunidades concretas passando pela sua frente toda semana. Vamos resolver isso?`,
        ],
        Comunicação: [
          `Oi {nome}! Me conta: já perdeu uma oportunidade importante porque não conseguiu se expressar da forma certa na hora certa?`,
          `{nome}, comunicação de impacto não é dom — é estrutura. Tem 3 elementos específicos que qualquer pessoa pode aprender. Curioso pra saber quais são?`,
          `{nome}, {qs_percentual}/100 em Comunicação. Cada reunião sem impacto, cada proposta rejeitada — tem custo real acumulado. Bora virar esse jogo?`,
        ],
        Relacionamento: [
          `Oi {nome}! Pergunta direta: quantas pessoas na sua rede entrariam em contato com você hoje com uma oportunidade? Seja honesto.`,
          `{nome}, a diferença entre quem tem indicações chegando todo mês e quem fica esperando não é sorte — é intencionalidade. Posso te mostrar o sistema?`,
          `{nome}, rede superficial tem validade curta. {qs_percentual}/100 em Relacionamento é o ponto exato onde networking para de funcionar. Uma conversa pode mudar isso.`,
        ],
        Persuasão: [
          `Oi {nome}! Me conta: qual foi a última negociação ou conversa importante que você saiu sentindo que poderia ter ido melhor?`,
          `{nome}, persuasão não é manipulação — é fazer a outra pessoa enxergar o que você já enxerga. Tem uma técnica específica pra isso. Quer conhecer?`,
          `{nome}, {qs_percentual}/100 em Persuasão. Cada "vou pensar" que nunca voltou, cada venda perdida — tem um número real por trás disso. Vamos destravá-lo?`,
        ],
        Influência: [
          `Oi {nome}! Me diz: as pessoas ao seu redor buscam sua opinião antes de tomar decisões — ou só depois, pra validar o que já decidiram?`,
          `{nome}, influência não se pede — se constrói. E começa com uma mudança muito específica de como você se posiciona. Posso te mostrar?`,
          `{nome}, {qs_percentual}/100 em Influência. Em 2 anos, onde você quer ser visto no seu meio? Esse resultado é o ponto de partida — mas só se você agir agora.`,
        ],
      }

      const msgs = wppPorPilar[pilar_fraco] ?? wppPorPilar['Comunicação']

      await agendarVarias([
        // Emails (template buscado no banco por pilar + dia no momento do envio)
        { lead_id, tipo: 'email', payload: { template: 'dia_0' }, agendado_para: emMinutos(2) },
        { lead_id, tipo: 'email', payload: { template: 'dia_1' }, agendado_para: emDias(1) },
        { lead_id, tipo: 'email', payload: { template: 'dia_3' }, agendado_para: emDias(3) },
        { lead_id, tipo: 'email', payload: { template: 'dia_5' }, agendado_para: emDias(5) },
        { lead_id, tipo: 'email', payload: { template: 'dia_7' }, agendado_para: emDias(7) },
        // Follow-ups WhatsApp segmentados por pilar (dia usado para selecionar template)
        { lead_id, tipo: 'whatsapp_msg', payload: { texto: msgs[0], dia: '1' }, agendado_para: emDias(1) },
        { lead_id, tipo: 'whatsapp_msg', payload: { texto: msgs[1], dia: '3' }, agendado_para: emDias(3) },
        { lead_id, tipo: 'whatsapp_msg', payload: { texto: msgs[2], dia: '7' }, agendado_para: emDias(7) },
      ])
    } catch (e) {
      console.error('[quiz] erro ao agendar funil:', e)
    }

    return NextResponse.json({ qs_total, qs_percentual, nivel_qs, pilar_fraco }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/quiz]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

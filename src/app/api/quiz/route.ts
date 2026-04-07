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

    // Ações 3 + 5: agenda funil de emails (D+0..D+7) e follow-ups WhatsApp (D+1, D+3, D+7)
    try {
      const followupWpp = (dia: number) =>
        `Oi ${pilar_fraco ? '' : ''}— passou ${dia} ${dia === 1 ? 'dia' : 'dias'} desde seu diagnóstico. Quero te mandar um próximo passo prático sobre ${pilar_fraco}. Posso?`
      await agendarVarias([
        // Emails
        { lead_id, tipo: 'email', payload: { template: 'dia_0' }, agendado_para: emMinutos(2) },
        { lead_id, tipo: 'email', payload: { template: 'dia_1' }, agendado_para: emDias(1) },
        { lead_id, tipo: 'email', payload: { template: 'dia_3' }, agendado_para: emDias(3) },
        { lead_id, tipo: 'email', payload: { template: 'dia_5' }, agendado_para: emDias(5) },
        { lead_id, tipo: 'email', payload: { template: 'dia_7' }, agendado_para: emDias(7) },
        // Follow-ups WhatsApp
        {
          lead_id,
          tipo: 'whatsapp_msg',
          payload: { texto: followupWpp(1) },
          agendado_para: emDias(1),
        },
        {
          lead_id,
          tipo: 'whatsapp_msg',
          payload: { texto: followupWpp(3) },
          agendado_para: emDias(3),
        },
        {
          lead_id,
          tipo: 'whatsapp_msg',
          payload: { texto: followupWpp(7) },
          agendado_para: emDias(7),
        },
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

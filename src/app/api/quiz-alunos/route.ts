import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PILARES = ['A', 'B', 'C', 'D', 'E'] as const
type ScoresPilares = Record<typeof PILARES[number], number>

function calcularNivel(total: number): string {
  if (total <= 100) return 'Negligente'
  if (total <= 150) return 'Iniciante'
  if (total <= 200) return 'Intermediário'
  if (total <= 225) return 'Avançado'
  return 'Mestre'
}

function calcularPilarFraco(scores: ScoresPilares): string {
  const nomes: Record<string, string> = {
    A: 'Sociabilidade', B: 'Comunicação', C: 'Relacionamento', D: 'Persuasão', E: 'Influência',
  }
  const fraco = PILARES.reduce((min, p) => scores[p] < scores[min] ? p : min, PILARES[0])
  return nomes[fraco]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { scores } = body as { scores?: Partial<ScoresPilares> }

    if (!scores) {
      return NextResponse.json({ error: 'scores obrigatório' }, { status: 400 })
    }

    for (const p of PILARES) {
      const v = scores[p]
      if (typeof v !== 'number' || v < 10 || v > 50) {
        return NextResponse.json({ error: `Score do pilar ${p} inválido` }, { status: 400 })
      }
    }

    const typedScores = scores as ScoresPilares
    const qs_total = PILARES.reduce((sum, p) => sum + typedScores[p], 0)
    const qs_percentual = Math.round((qs_total / 250) * 100)
    const nivel_qs = calcularNivel(qs_total)
    const pilar_fraco = calcularPilarFraco(typedScores)

    const supabase = createAdminClient()

    // Cria lead anônimo — sem nome, email ou whatsapp obrigatórios
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        nome: 'Aluno',
        email: '',
        whatsapp: '',
        origem: 'quiz-alunos',
        qs_total,
        qs_percentual,
        scores: typedScores,
        nivel_qs,
        pilar_fraco,
      })
      .select('id')
      .single()

    if (error || !lead) {
      console.error('[quiz-alunos] erro ao salvar:', error)
      return NextResponse.json({ error: 'Erro ao salvar resultado' }, { status: 500 })
    }

    return NextResponse.json({ lead_id: lead.id, qs_total, qs_percentual, nivel_qs, pilar_fraco })
  } catch (err) {
    console.error('[quiz-alunos]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

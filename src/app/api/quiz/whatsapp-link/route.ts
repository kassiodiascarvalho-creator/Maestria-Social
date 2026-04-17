import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

function normalizarTelefone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id } = body as { lead_id?: string }

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: lead, error } = await supabase
      .from('leads')
      .select('nome,qs_total,qs_percentual,nivel_qs,pilar_fraco,scores')
      .eq('id', lead_id)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    const numeroDestino = (await getConfig('META_WHATSAPP_NUMBER')) || '5533984522635'

    // Calcula % do pilar fraco (score do pilar / 50 * 100)
    const NOME_PARA_KEY: Record<string, string> = {
      Sociabilidade: 'A',
      Comunicação: 'B',
      Relacionamento: 'C',
      Persuasão: 'D',
      Influência: 'E',
    }
    const scores = (lead.scores ?? {}) as Record<string, number>
    const keyPilar = NOME_PARA_KEY[lead.pilar_fraco ?? ''] ?? 'B'
    const scorePilar = scores[keyPilar] ?? 0
    const percentualPilar = Math.round((scorePilar / 50) * 100)

    const texto = [
      `Oi, fiz o Teste de Quociente Social e meu resultado foi ${lead.qs_percentual ?? Math.round(((lead.qs_total ?? 0) / 250) * 100)}/100 — ${lead.nivel_qs ?? 'N/A'}.`,
      `Meu pilar mais fraco é ${lead.pilar_fraco ?? 'Comunicação'} com ${percentualPilar}%.`,
      'Quero entender meu próximo passo.',
    ].join(' ')

    const link = `https://wa.me/${normalizarTelefone(numeroDestino)}?text=${encodeURIComponent(texto)}`
    return NextResponse.json({ link, texto })
  } catch (err) {
    console.error('[quiz/whatsapp-link]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

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
      .select('nome,qs_total,qs_percentual,nivel_qs,pilar_fraco')
      .eq('id', lead_id)
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    const numeroDestino = await getConfig('META_WHATSAPP_NUMBER')
    if (!numeroDestino) {
      return NextResponse.json(
        { error: 'META_WHATSAPP_NUMBER não configurado no painel de integrações' },
        { status: 400 }
      )
    }

    const texto = [
      `Olá! Eu sou ${lead.nome}.`,
      `Meu resultado no Quociente Social foi ${lead.qs_total ?? 0}/250 (${lead.qs_percentual ?? 0}%), nível ${lead.nivel_qs ?? 'N/A'}.`,
      `Meu pilar com maior oportunidade de desenvolvimento é ${lead.pilar_fraco ?? 'Comunicação'}.`,
      'Quero desenvolver minha influência e receber meu próximo passo.',
    ].join(' ')

    const link = `https://wa.me/${normalizarTelefone(numeroDestino)}?text=${encodeURIComponent(texto)}`
    return NextResponse.json({ link, texto })
  } catch (err) {
    console.error('[quiz/whatsapp-link]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

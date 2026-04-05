import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPrimeiraMsg } from '@/lib/agente/prompts'
import { enviarMensagemWhatsApp } from '@/lib/meta'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id } = body as { lead_id?: string }

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Verificar se já existe alguma conversa (evitar duplicar primeira mensagem)
    const { count } = await supabase
      .from('conversas')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', lead_id)

    if (count && count > 0) {
      return NextResponse.json({ ok: true, ignorado: true })
    }

    const primeiraMsg = buildPrimeiraMsg(lead)

    // Salvar no histórico como mensagem do assistente
    await supabase.from('conversas').insert({
      lead_id,
      role: 'assistant' as const,
      mensagem: primeiraMsg,
    })

    // Enviar via WhatsApp
    if (lead.whatsapp) {
      const telefoneFormatado = lead.whatsapp.replace(/\D/g, '')
      const telefoneFull = telefoneFormatado.startsWith('55')
        ? telefoneFormatado
        : `55${telefoneFormatado}`

      await enviarMensagemWhatsApp(telefoneFull, primeiraMsg)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[agente/iniciar]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

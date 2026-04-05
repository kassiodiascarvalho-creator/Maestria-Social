import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — verificação do webhook pela Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — recebe mensagens do WhatsApp via Meta Cloud API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Estrutura padrão do payload Meta Cloud API
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value?.messages?.length) {
      // Pode ser notificação de status — ignorar silenciosamente
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const message = value.messages[0]
    const from = message.from        // número do remetente (whatsapp)
    const text = message?.text?.body // texto da mensagem

    if (!from || !text) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const supabase = createAdminClient()

    // Busca lead pelo WhatsApp
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, nome, pilar_fraco, nivel_qs, scores, status_lead')
      .eq('whatsapp', from)
      .single()

    if (leadError || !lead) {
      console.warn('[webhook/meta] Lead não encontrado para WhatsApp:', from)
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // Salva mensagem do usuário no histórico
    await supabase.from('conversas').insert({
      lead_id: lead.id,
      role: 'user',
      mensagem: text,
    })

    // Dispara processamento do agente SDR de forma assíncrona
    // (não aguarda — retorna 200 imediatamente para a Meta)
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', '') || ''}${process.env.NEXTAUTH_URL || ''}/api/agente/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, mensagem: text }),
    }).catch((err) => console.error('[webhook/meta] Erro ao acionar agente:', err))

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/webhook/meta]', err)
    // Sempre retorna 200 para a Meta não reenviar
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }
}

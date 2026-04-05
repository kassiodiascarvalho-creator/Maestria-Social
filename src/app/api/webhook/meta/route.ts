import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

// GET — verificação do webhook pela Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = await getConfig('META_VERIFY_TOKEN')

  if (mode === 'subscribe' && token && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — recebe mensagens do WhatsApp via Meta Cloud API
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }

  try {
    const entry = (body as Record<string, unknown>)?.entry as Record<string, unknown>[] | undefined
    const changes = entry?.[0]?.changes as Record<string, unknown>[] | undefined
    const value = changes?.[0]?.value as Record<string, unknown> | undefined

    if (!value?.messages) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const messages = value.messages as Record<string, unknown>[]
    if (!messages.length) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const phoneNumberId = value.metadata
      ? (value.metadata as Record<string, string>).phone_number_id
      : undefined

    const message = messages[0]
    const from = message.from as string
    const text = (message.text as Record<string, string> | undefined)?.body

    if (!from || !text) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // ── Roteamento por número ─────────────────────────────────────────────────
    // Se tiver múltiplos números no mesmo App Meta, verificar se este phone_number_id
    // pertence ao Maestria Social. Se não, encaminhar para a outra plataforma.
    const maestriaPhoneId = await getConfig('META_PHONE_NUMBER_ID')
    const forwardUrl = await getConfig('META_FORWARD_WEBHOOK_URL')

    if (phoneNumberId && maestriaPhoneId && phoneNumberId !== maestriaPhoneId) {
      // Este webhook não é para o Maestria Social — encaminhar para outra plataforma
      if (forwardUrl) {
        fetch(forwardUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch((err) => console.error('[webhook/meta] Erro ao encaminhar:', err))
      }
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // ── Processar mensagem do Maestria Social ─────────────────────────────────
    const supabase = createAdminClient()

    // Normalizar número (remover formatação, garantir DDI 55)
    const digitos = from.replace(/\D/g, '')
    const telefoneNormalizado = digitos.startsWith('55') ? digitos : `55${digitos}`
    const telefoneCurto = digitos.startsWith('55') ? digitos.slice(2) : digitos

    // Busca lead pelo WhatsApp (tenta com e sem DDI)
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .or(`whatsapp.ilike.%${telefoneCurto}%,whatsapp.ilike.%${telefoneNormalizado}%`)
      .limit(1)
      .single()

    if (!lead) {
      console.warn('[webhook/meta] Lead não encontrado para WhatsApp:', from)
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    // Dispara agente SDR de forma assíncrona (retorna 200 imediatamente para a Meta)
    const host = req.headers.get('host') || 'maestria-social.vercel.app'
    const proto = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${proto}://${host}`

    fetch(`${baseUrl}/api/agente/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, mensagem: text }),
    }).catch((err) => console.error('[webhook/meta] Erro ao acionar agente:', err))

    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/webhook/meta]', err)
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }
}

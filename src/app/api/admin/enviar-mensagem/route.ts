import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'

async function getCredenciais() {
  const phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
  const accessToken = await getConfig('META_ACCESS_TOKEN')
  if (!phoneNumberId || !accessToken) {
    throw new Error('META_PHONE_NUMBER_ID ou META_ACCESS_TOKEN não configurados')
  }
  return { phoneNumberId, accessToken }
}

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function tipoMidia(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

async function uploadMidiaParaMeta(
  file: File,
  phoneNumberId: string,
  accessToken: string
): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('type', file.type)
  form.append('messaging_product', 'whatsapp')

  const res = await fetch(`${META_API_URL}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Erro ao fazer upload de mídia: ${erro}`)
  }

  const data = await res.json() as { id: string }
  return data.id
}

async function enviarTexto(para: string, texto: string, phoneNumberId: string, accessToken: string) {
  const res = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { body: texto },
    }),
  })
  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Erro ao enviar texto: ${erro}`)
  }
}

async function enviarMidia(
  para: string,
  mediaId: string,
  tipo: 'image' | 'video' | 'audio' | 'document',
  caption: string | undefined,
  filename: string | undefined,
  phoneNumberId: string,
  accessToken: string
) {
  const mediaPayload: Record<string, unknown> = { id: mediaId }
  if (caption && (tipo === 'image' || tipo === 'video' || tipo === 'document')) {
    mediaPayload.caption = caption
  }
  if (tipo === 'document' && filename) {
    mediaPayload.filename = filename
  }

  const res = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: tipo,
      [tipo]: mediaPayload,
    }),
  })
  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Erro ao enviar mídia: ${erro}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const leadId = form.get('lead_id') as string
    const texto = form.get('texto') as string | null
    const caption = form.get('caption') as string | null
    const file = form.get('file') as File | null

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 })
    }
    if (!texto && !file) {
      return NextResponse.json({ error: 'Envie texto ou arquivo' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: lead } = await supabase
      .from('leads')
      .select('whatsapp')
      .eq('id', leadId)
      .single()

    if (!lead?.whatsapp) {
      return NextResponse.json({ error: 'Lead não encontrado ou sem WhatsApp' }, { status: 404 })
    }

    const { phoneNumberId, accessToken } = await getCredenciais()
    const para = normalizarTelefone(lead.whatsapp)

    let mensagemSalva = ''

    if (file) {
      const tipo = tipoMidia(file.type)
      const mediaId = await uploadMidiaParaMeta(file, phoneNumberId, accessToken)
      await enviarMidia(para, mediaId, tipo, caption ?? undefined, file.name, phoneNumberId, accessToken)
      mensagemSalva = caption ? `[${tipo}: ${file.name}] ${caption}` : `[${tipo}: ${file.name}]`
    } else if (texto) {
      await enviarTexto(para, texto, phoneNumberId, accessToken)
      mensagemSalva = texto
    }

    await supabase.from('conversas').insert({
      lead_id: leadId,
      role: 'assistant',
      mensagem: mensagemSalva,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[enviar-mensagem]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

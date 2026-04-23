import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensagemWhatsApp } from '@/lib/meta'
import { enviarViaBaileys, enviarMidiaBase64ViaBaileys } from '@/lib/baileys'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'
const BUCKET = 'midia-crm'

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

function tagMensagem(tipo: string, filename: string, url: string): string {
  if (tipo === 'audio') return `[áudio:${url}]`
  if (tipo === 'image') return `[imagem:${url}]`
  if (tipo === 'video') return `[vídeo:${url}]`
  return `[documento:${filename}:${url}]`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadParaStorage(supabase: any, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin'
  const storagePath = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  let { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  // Cria o bucket automaticamente se não existir
  if (error?.message?.includes('Bucket not found') || error?.message?.includes('not found')) {
    await supabase.storage.createBucket(BUCKET, { public: true })
    const retry = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false })
    error = retry.error
  }

  if (error) throw new Error(`Upload Storage falhou: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return publicUrl
}

async function uploadMidiaParaMeta(file: File, phoneNumberId: string, accessToken: string): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('type', file.type)
  form.append('messaging_product', 'whatsapp')

  const res = await fetch(`${META_API_URL}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Erro ao fazer upload de mídia na Meta: ${await res.text()}`)
  const data = await res.json() as { id: string }
  return data.id
}

async function enviarMidiaViaMeta(
  para: string, mediaId: string, tipo: 'image' | 'video' | 'audio' | 'document',
  caption: string | undefined, filename: string | undefined,
  phoneNumberId: string, accessToken: string
) {
  const mediaPayload: Record<string, unknown> = { id: mediaId }
  if (caption && (tipo === 'image' || tipo === 'video' || tipo === 'document')) mediaPayload.caption = caption
  if (tipo === 'document' && filename) mediaPayload.filename = filename

  const res = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: tipo, [tipo]: mediaPayload }),
  })
  if (!res.ok) throw new Error(`Erro ao enviar mídia via Meta: ${await res.text()}`)
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const leadId = form.get('lead_id') as string
    const texto = form.get('texto') as string | null
    const caption = form.get('caption') as string | null
    const file = form.get('file') as File | null
    const canal = (form.get('canal') as string | null) ?? 'baileys'

    if (!leadId) return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 })
    if (!texto && !file) return NextResponse.json({ error: 'Envie texto ou arquivo' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const { data: lead } = await supabase.from('leads').select('whatsapp').eq('id', leadId).single()
    if (!lead?.whatsapp) return NextResponse.json({ error: 'Lead não encontrado ou sem WhatsApp' }, { status: 404 })

    const para = normalizarTelefone(lead.whatsapp)
    let mensagemSalva = ''

    if (file) {
      const tipo = tipoMidia(file.type)

      // 1. Converte para base64 (para Baileys — mais confiável que URL download)
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')

      // 2. Upload para Supabase Storage → URL para exibição no CRM
      const publicUrl = await uploadParaStorage(supabase, file)
      mensagemSalva = tagMensagem(tipo, file.name, publicUrl)

      // Para Meta API, audio/webm não é suportado — reempacota como audio/ogg (mesmo codec Opus, container diferente)
      const fileParaMeta = (tipo === 'audio' && file.type.includes('webm'))
        ? new File([buffer], file.name.replace(/\.webm$/, '') + '.ogg', { type: 'audio/ogg' })
        : file

      if (canal === 'meta') {
        // Canal Oficial: Meta API diretamente
        const phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
        const accessToken = await getConfig('META_ACCESS_TOKEN')
        if (!phoneNumberId || !accessToken) {
          throw new Error('META_PHONE_NUMBER_ID ou META_ACCESS_TOKEN não configurados')
        }
        const mediaId = await uploadMidiaParaMeta(fileParaMeta, phoneNumberId, accessToken)
        await enviarMidiaViaMeta(para, mediaId, tipo, caption ?? undefined, fileParaMeta.name, phoneNumberId, accessToken)
      } else {
        // Canal Baileys: envia base64 direto
        // Para áudio webm: ptt=false (arquivo de áudio normal, sem exigir OGG)
        let enviado = false
        try {
          const ptt = tipo === 'audio' && !file.type.includes('webm') ? true : false
          await enviarMidiaBase64ViaBaileys(para, base64, file.type, tipo, file.name, undefined, tipo === 'audio' ? ptt : undefined)
          enviado = true
        } catch (errBaileys) {
          console.warn('[enviar-mensagem] Baileys falhou, tentando Meta:', errBaileys)
        }

        if (!enviado) {
          const phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
          const accessToken = await getConfig('META_ACCESS_TOKEN')
          if (!phoneNumberId || !accessToken) {
            throw new Error('Mídia não pôde ser enviada: Baileys indisponível e Meta API não configurada')
          }
          const mediaId = await uploadMidiaParaMeta(fileParaMeta, phoneNumberId, accessToken)
          await enviarMidiaViaMeta(para, mediaId, tipo, caption ?? undefined, fileParaMeta.name, phoneNumberId, accessToken)
        }
      }
    } else if (texto) {
      if (canal === 'meta') {
        await enviarMensagemWhatsApp(para, texto)
      } else {
        let enviado = false
        try {
          await enviarViaBaileys(para, texto)
          enviado = true
        } catch { /* fallback abaixo */ }
        if (!enviado) await enviarMensagemWhatsApp(para, texto)
      }
      mensagemSalva = texto
    }

    await supabase.from('conversas').insert({ lead_id: leadId, role: 'assistant', mensagem: mensagemSalva })

    await supabase
      .from('leads')
      .update({
        ultima_atividade_humana: new Date().toISOString(),
        etiqueta: 'humano_atendendo',
      })
      .eq('id', leadId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[enviar-mensagem]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

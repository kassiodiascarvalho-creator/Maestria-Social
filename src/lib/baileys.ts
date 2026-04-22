import { getConfig } from '@/lib/config'

async function baileysDisparar(
  phone: string,
  payload: Record<string, unknown>,
  instanceId?: string,
): Promise<void> {
  const apiUrl = await getConfig('BAILEYS_API_URL')
  if (!apiUrl) throw new Error('BAILEYS_API_URL não configurada nas Integrações')

  const base = apiUrl.replace(/\/$/, '')
  const url = instanceId
    ? `${base}/instancia/${instanceId}/disparar`
    : `${base}/disparar`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, ...payload }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Baileys: ${err}`)
  }
}

/**
 * Envia mensagem de texto via servidor Baileys local.
 */
export async function enviarViaBaileys(telefone: string, texto: string, instanceId?: string): Promise<void> {
  const phone = telefone.replace(/\D/g, '')
  await baileysDisparar(phone, { type: 'text', content: texto }, instanceId)
}

/**
 * Envia áudio via servidor Baileys local.
 * @param audioUrl URL pública do arquivo de áudio
 */
export async function enviarAudioViaBaileys(telefone: string, audioUrl: string, instanceId?: string): Promise<void> {
  const phone = telefone.replace(/\D/g, '')
  await baileysDisparar(phone, { type: 'audio', content: audioUrl }, instanceId)
}

/**
 * Envia arquivo de mídia via Baileys usando base64 (para formatos não suportados pela Meta API).
 * Útil para audio/webm gravado no navegador Chrome.
 */
export async function enviarMidiaViaBaileys(
  telefone: string,
  tipo: 'image' | 'video' | 'document' | 'audio',
  url: string,
  caption?: string,
  filename?: string,
  instanceId?: string,
  ptt?: boolean,
): Promise<void> {
  const phone = telefone.replace(/\D/g, '')
  const payload: Record<string, unknown> = { type: tipo, content: url }
  if (caption) payload.caption = caption
  if (filename) payload.filename = filename
  if (ptt !== undefined) payload.ptt = ptt
  await baileysDisparar(phone, payload, instanceId)
}

export async function enviarMidiaBase64ViaBaileys(
  telefone: string,
  base64: string,
  mimeType: string,
  tipo: 'audio' | 'image' | 'video' | 'document',
  filename: string,
  instanceId?: string,
  ptt?: boolean,
): Promise<void> {
  const phone = telefone.replace(/\D/g, '')
  const payload: Record<string, unknown> = { type: tipo, content: base64, mimeType, filename }
  if (ptt !== undefined) payload.ptt = ptt
  await baileysDisparar(phone, payload, instanceId)
}

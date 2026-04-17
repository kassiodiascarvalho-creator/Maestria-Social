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

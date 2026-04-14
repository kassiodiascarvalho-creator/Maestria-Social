import { getConfig } from '@/lib/config'

/**
 * Envia mensagem de texto via servidor Baileys local.
 * Requer BAILEYS_API_URL configurado nas Integrações.
 */
export async function enviarViaBaileys(telefone: string, texto: string): Promise<void> {
  const apiUrl = await getConfig('BAILEYS_API_URL')
  if (!apiUrl) throw new Error('BAILEYS_API_URL não configurada nas Integrações')

  const phone = telefone.replace(/\D/g, '')
  const url = apiUrl.replace(/\/$/, '') + '/disparar'

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, type: 'text', content: texto }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Baileys: ${err}`)
  }
}

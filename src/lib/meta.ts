// Helper para Meta Cloud API (WhatsApp Business)

const META_API_URL = 'https://graph.facebook.com/v21.0'

export async function enviarMensagemWhatsApp(
  para: string,
  texto: string
): Promise<void> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  const accessToken = process.env.META_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.warn('[meta] META_PHONE_NUMBER_ID ou META_ACCESS_TOKEN não configurados')
    return
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
      type: 'text',
      text: { body: texto },
    }),
  })

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`[meta] Erro ao enviar mensagem: ${erro}`)
  }
}

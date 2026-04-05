import { getConfig } from './config'

const META_API_URL = 'https://graph.facebook.com/v21.0'

function normalizarTelefone(telefone: string): string {
  const digits = telefone.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

async function getMetaCredenciais() {
  const phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
  const accessToken = await getConfig('META_ACCESS_TOKEN')

  if (!phoneNumberId || !accessToken) {
    throw new Error('[meta] META_PHONE_NUMBER_ID ou META_ACCESS_TOKEN não configurados')
  }

  return { phoneNumberId, accessToken }
}

async function postMeta(payload: Record<string, unknown>) {
  const { phoneNumberId, accessToken } = await getMetaCredenciais()
  const res = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`[meta] Erro ao enviar mensagem: ${erro}`)
  }
}

export async function enviarMensagemWhatsApp(para: string, texto: string): Promise<void> {
  await postMeta({
    messaging_product: 'whatsapp',
    to: normalizarTelefone(para),
    type: 'text',
    text: { body: texto },
  })
}

export async function enviarTemplateWhatsApp(
  para: string,
  nomeTemplate: string,
  languageCode = 'pt_BR'
): Promise<void> {
  await postMeta({
    messaging_product: 'whatsapp',
    to: normalizarTelefone(para),
    type: 'template',
    template: {
      name: nomeTemplate,
      language: { code: languageCode },
    },
  })
}

export async function enviarMensagemInicialWhatsApp(para: string, textoFallback: string): Promise<void> {
  const nomeTemplate = await getConfig('META_TEMPLATE_NAME')
  const templateLanguage = (await getConfig('META_TEMPLATE_LANGUAGE')) || 'pt_BR'

  if (nomeTemplate) {
    await enviarTemplateWhatsApp(para, nomeTemplate, templateLanguage)
    return
  }

  await enviarMensagemWhatsApp(para, textoFallback)
}

export async function marcarMensagemComoLida(messageId: string): Promise<void> {
  await postMeta({
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

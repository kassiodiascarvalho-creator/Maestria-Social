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

async function getCoexistenciaUrl(): Promise<string | null> {
  // IMPORTANTE: apenas COEXISTENCIA_WEBHOOK_URL é usada para ENVIAR mensagens
  // via parceiro de coexistência. META_FORWARD_WEBHOOK_URL é SÓ para
  // encaminhar mensagens RECEBIDAS de outro número (ex: clínica), nunca
  // deve ser usada como destino de envio do Maestria.
  return await getConfig('COEXISTENCIA_WEBHOOK_URL')
}

async function enviarViaCoexistencia(payload: Record<string, unknown>): Promise<void> {
  const coexistenciaUrl = await getCoexistenciaUrl()
  if (!coexistenciaUrl) {
    throw new Error('[meta] COEXISTENCIA_WEBHOOK_URL/META_FORWARD_WEBHOOK_URL não configurado')
  }

  const res = await fetch(coexistenciaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'maestria_outbound_message',
      source: 'maestria-social',
      payload,
    }),
  })

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`[coexistencia] Erro ao enviar mensagem: ${erro}`)
  }
}

async function getWhatsAppMode(): Promise<'meta' | 'coexistencia'> {
  const value = (await getConfig('WHATSAPP_MODE'))?.toLowerCase()
  if (value !== 'coexistencia') return 'meta'

  // Evita loop: se COEXISTENCIA_WEBHOOK_URL aponta para o próprio sistema, usa modo meta
  const coexUrl = await getCoexistenciaUrl()
  if (!coexUrl || coexUrl.includes('maestria-social.vercel.app')) return 'meta'

  return 'coexistencia'
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
  const to = normalizarTelefone(para)
  const mode = await getWhatsAppMode()

  if (mode === 'coexistencia') {
    await enviarViaCoexistencia({ to, type: 'text', text: { body: texto } })
    return
  }

  try {
    await postMeta({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: texto },
    })
  } catch (err) {
    const coexistenciaUrl = await getCoexistenciaUrl()
    if (!coexistenciaUrl) throw err
    console.warn('[meta] Falha na Meta, enviando via coexistência.')
    await enviarViaCoexistencia({ to, type: 'text', text: { body: texto } })
  }
}

type TemplateParam = { type: 'text'; text: string }

export async function enviarTemplateWhatsApp(
  para: string,
  nomeTemplate: string,
  params: string[] = [],
  languageCode = 'pt_BR'
): Promise<void> {
  const template: Record<string, unknown> = {
    name: nomeTemplate,
    language: { code: languageCode },
  }

  if (params.length > 0) {
    const parametros: TemplateParam[] = params.map((text) => ({ type: 'text', text }))
    template.components = [{ type: 'body', parameters: parametros }]
  }

  await postMeta({
    messaging_product: 'whatsapp',
    to: normalizarTelefone(para),
    type: 'template',
    template,
  })
}

export async function enviarMensagemInicialWhatsApp(
  para: string,
  textoFallback: string,
  templateParams?: { nome: string; qs_total: number; pilar_fraco: string }
): Promise<void> {
  const mode = await getWhatsAppMode()
  if (mode === 'coexistencia') {
    await enviarMensagemWhatsApp(para, textoFallback)
    return
  }

  const nomeTemplate = await getConfig('META_TEMPLATE_NAME')
  const templateLanguage = (await getConfig('META_TEMPLATE_LANGUAGE')) || 'pt_BR'

  if (nomeTemplate) {
    const params = templateParams
      ? [templateParams.nome, String(templateParams.qs_total), templateParams.pilar_fraco]
      : []
    await enviarTemplateWhatsApp(para, nomeTemplate, params, templateLanguage)
    return
  }

  await enviarMensagemWhatsApp(para, textoFallback)
}

export async function marcarMensagemComoLida(
  messageId: string,
  credenciais?: { phoneNumberId: string; accessToken: string }
): Promise<void> {
  if (credenciais) {
    await fetch(`${META_API_URL}/${credenciais.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credenciais.accessToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
    })
    return
  }
  await postMeta({ messaging_product: 'whatsapp', status: 'read', message_id: messageId })
}

/**
 * Envia áudio via Meta WhatsApp API (URL pública).
 */
export async function enviarAudioViaMeta(para: string, audioUrl: string): Promise<void> {
  const to = normalizarTelefone(para)
  const mode = await getWhatsAppMode()

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'audio',
    audio: { link: audioUrl },
  }

  if (mode === 'coexistencia') {
    await enviarViaCoexistencia({ to, type: 'audio', audio: { link: audioUrl } })
    return
  }

  try {
    await postMeta(payload)
  } catch (err) {
    const coexistenciaUrl = await getCoexistenciaUrl()
    if (!coexistenciaUrl) throw err
    console.warn('[meta] Falha ao enviar áudio via Meta, tentando coexistência.')
    await enviarViaCoexistencia({ to, type: 'audio', audio: { link: audioUrl } })
  }
}

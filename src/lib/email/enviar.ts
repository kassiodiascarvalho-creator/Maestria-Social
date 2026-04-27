import { Resend } from 'resend'
import { getConfig } from '@/lib/config'

let _resend: Resend | null = null

async function getResend(): Promise<Resend> {
  if (_resend) return _resend
  const apiKey = process.env.RESEND_API_KEY || (await getConfig('RESEND_API_KEY'))
  if (!apiKey) throw new Error('[email] RESEND_API_KEY não configurada')
  _resend = new Resend(apiKey)
  return _resend
}

async function getRemetente(): Promise<string> {
  return (
    process.env.EMAIL_FROM ||
    (await getConfig('EMAIL_FROM')) ||
    'Maestria Social <time@maestriasocial.com>'
  )
}

export interface EnviarEmailInput {
  para: string
  assunto: string
  html: string
  texto?: string
}

export async function enviarEmail(input: EnviarEmailInput): Promise<void> {
  const resend = await getResend()
  const from = await getRemetente()
  const { error } = await resend.emails.send({
    from,
    to: [input.para],
    subject: input.assunto,
    html: input.html,
    text: input.texto,
    headers: {
      'List-Unsubscribe': '<mailto:time@maestriasocial.com?subject=unsubscribe>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID': `maestria-${Date.now()}`,
    },
  })
  if (error) {
    throw new Error(`[email] ${error.message || 'falha ao enviar'}`)
  }
}

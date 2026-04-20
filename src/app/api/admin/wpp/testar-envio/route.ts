import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'

function normalizarTelefone(tel: string): string {
  const d = tel.replace(/\D/g, '')
  return d.startsWith('55') ? d : `55${d}`
}

// Conta quantos {{N}} existem nos componentes de um template
function contarParametros(components: Record<string, unknown>[]): number {
  let count = 0
  for (const comp of components) {
    if ((comp.type as string) !== 'BODY') continue
    const text = (comp.text as string) ?? ''
    const matches = text.match(/\{\{\d+\}\}/g)
    if (matches) count += matches.length
  }
  return count
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { telefone, template_name, template_lang = 'pt_BR', vars = [] } = body

  if (!telefone || !template_name) {
    return NextResponse.json({ error: 'telefone e template_name são obrigatórios' }, { status: 400 })
  }

  const phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
  const accessToken = await getConfig('META_ACCESS_TOKEN')

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json({ error: 'META_PHONE_NUMBER_ID ou META_ACCESS_TOKEN não configurados' }, { status: 500 })
  }

  const to = normalizarTelefone(telefone)
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template_name,
      language: { code: template_lang },
      ...(vars.length > 0
        ? {
            components: [{
              type: 'body',
              parameters: vars.map((v: string) => ({ type: 'text', text: v })),
            }],
          }
        : {}),
    },
  }

  const res = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  const resposta = await res.json()

  return NextResponse.json({
    ok: res.ok,
    http_status: res.status,
    telefone_enviado: to,
    payload_enviado: payload,
    resposta_meta: resposta,
    message_id: res.ok ? (resposta?.messages?.[0]?.id ?? null) : null,
    erro: !res.ok ? (resposta?.error?.message ?? JSON.stringify(resposta)) : null,
    codigo_erro: !res.ok ? (resposta?.error?.code ?? null) : null,
  })
}

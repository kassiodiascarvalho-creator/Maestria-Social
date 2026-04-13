import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setConfig, getConfig } from '@/lib/config'

const ALLOWED_KEYS = [
  'OPENAI_API_KEY',
  'INTEGRACOES_API_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'WHATSAPP_MODE',
  'COEXISTENCIA_WEBHOOK_URL',
  'META_VERIFY_TOKEN',
  'META_ACCESS_TOKEN',
  'META_PHONE_NUMBER_ID',
  'META_WHATSAPP_NUMBER',
  'META_TEMPLATE_NAME',
  'META_TEMPLATE_LANGUAGE',
  'META_WABA_ID',
  'META_FORWARD_WEBHOOK_URL',
  'AGENT_TEMPERATURE',
  'AGENT_SYSTEM_PROMPT',
  'AGENT_ATIVO',
  'AGENT_MODEL',
]

export async function POST(req: NextRequest) {
  // Verificar autenticação
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { key, value } = await req.json() as { key?: string; value?: string }

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Chave inválida' }, { status: 400 })
  }
  if (!value?.trim()) {
    return NextResponse.json({ error: 'Valor não pode ser vazio' }, { status: 400 })
  }

  await setConfig(key, value.trim())
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  // searchParams from URL constructor is sync — Next.js async searchParams only applies to page props
  const key = searchParams.get('key')

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Chave inválida' }, { status: 400 })
  }

  const value = await getConfig(key)
  // Retorna apenas se está definido (sem expor o valor completo)
  return NextResponse.json({ defined: !!value })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConfig } from '@/lib/config'

const ALLOWED_KEYS = [
  'AGENT_SYSTEM_PROMPT',
  'AGENT_TEMPERATURE',
  'AGENT_ATIVO',
  'AGENT_MODEL',
  'META_PHONE_NUMBER_ID',
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Chave inválida' }, { status: 400 })
  }

  const value = await getConfig(key)
  return NextResponse.json({ value })
}

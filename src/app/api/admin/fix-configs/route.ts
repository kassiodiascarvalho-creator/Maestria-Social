import { NextRequest, NextResponse } from 'next/server'
import { setConfig } from '@/lib/config'

// Endpoint de uso único para corrigir configurações inválidas no banco.
// Protegido por token fixo — remova após usar.
const FIX_TOKEN = 'fix-maestria-2024'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== FIX_TOKEN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const fixes: Record<string, string> = {}
  await setConfig('WHATSAPP_MODE', 'meta')
  fixes['WHATSAPP_MODE'] = 'meta'
  await setConfig('META_PHONE_NUMBER_ID', '1060702587117156')
  fixes['META_PHONE_NUMBER_ID'] = '1060702587117156'
  await setConfig('COEXISTENCIA_WEBHOOK_URL', '')
  fixes['COEXISTENCIA_WEBHOOK_URL'] = '(removido)'
  await setConfig('META_FORWARD_WEBHOOK_URL', 'https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook')
  fixes['META_FORWARD_WEBHOOK_URL'] = 'https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook'

  return NextResponse.json({ ok: true, fixes })
}

export async function POST(req: NextRequest) {
  const { token } = await req.json() as { token?: string }
  if (token !== FIX_TOKEN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const fixes: Record<string, string> = {}

  // Corrige WHATSAPP_MODE
  await setConfig('WHATSAPP_MODE', 'meta')
  fixes['WHATSAPP_MODE'] = 'meta'

  // Corrige META_PHONE_NUMBER_ID (remove \n e espaços)
  await setConfig('META_PHONE_NUMBER_ID', '1060702587117156')
  fixes['META_PHONE_NUMBER_ID'] = '1060702587117156'

  // Remove COEXISTENCIA_WEBHOOK_URL (estava apontando para si mesmo)
  await setConfig('COEXISTENCIA_WEBHOOK_URL', '')
  fixes['COEXISTENCIA_WEBHOOK_URL'] = '(removido)'

  return NextResponse.json({ ok: true, fixes })
}

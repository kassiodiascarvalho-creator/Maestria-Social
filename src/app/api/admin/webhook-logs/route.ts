import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/config'

const TOKEN = process.env.FIX_ADMIN_TOKEN ?? 'fix-maestria-2024'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (searchParams.get('clear') === '1') {
    await setConfig('WEBHOOK_DEBUG_LOG', '[]')
    return NextResponse.json({ ok: true, cleared: true })
  }

  const canal = searchParams.get('canal') ?? 'meta'
  const chave = canal === 'baileys' ? 'BAILEYS_WEBHOOK_DEBUG' : 'WEBHOOK_DEBUG_LOG'
  const raw = (await getConfig(chave)) || '[]'
  try {
    return NextResponse.json({ logs: JSON.parse(raw) })
  } catch {
    return NextResponse.json({ logs: [], raw })
  }
}

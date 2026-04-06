import { NextRequest, NextResponse } from 'next/server'
import { getConfig, setConfig } from '@/lib/config'

const TOKEN = 'fix-maestria-2024'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (searchParams.get('clear') === '1') {
    await setConfig('WEBHOOK_DEBUG_LOG', '[]')
    return NextResponse.json({ ok: true, cleared: true })
  }

  const raw = (await getConfig('WEBHOOK_DEBUG_LOG')) || '[]'
  try {
    return NextResponse.json({ logs: JSON.parse(raw) })
  } catch {
    return NextResponse.json({ logs: [], raw })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'

const TOKEN = 'fix-maestria-2024'
const WABA_ID = '1560648865246207'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const accessToken = await getConfig('META_ACCESS_TOKEN')
  if (!accessToken) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN não configurado' }, { status: 400 })
  }

  // 1. Inscreve o app na WABA
  const subscribeRes = await fetch(
    `https://graph.facebook.com/v22.0/${WABA_ID}/subscribed_apps`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  const subscribeData = await subscribeRes.json()

  // 2. Lista apps inscritos para confirmar
  const listRes = await fetch(
    `https://graph.facebook.com/v22.0/${WABA_ID}/subscribed_apps`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const listData = await listRes.json()

  return NextResponse.json({
    inscricao: { status: subscribeRes.status, resposta: subscribeData },
    appsInscritos: listData,
  })
}

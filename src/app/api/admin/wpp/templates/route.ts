import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'

// GET — busca templates da conta WhatsApp Business (todos os status)
export async function GET() {
  try {
    const wabaId = await getConfig('META_WABA_ID')
    const accessToken = await getConfig('META_ACCESS_TOKEN')

    if (!wabaId || !accessToken) {
      return NextResponse.json(
        { error: 'META_WABA_ID ou META_ACCESS_TOKEN não configurados nas Integrações' },
        { status: 500 }
      )
    }

    const url = `${META_API_URL}/${wabaId}/message_templates?limit=100&fields=name,language,category,status,components`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const json = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: `Meta API erro: ${json?.error?.message ?? res.statusText}`, waba_id_usado: wabaId },
        { status: 500 }
      )
    }

    const templates = (json.data ?? []).map((t: Record<string, unknown>) => ({
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      components: t.components,
    }))

    return NextResponse.json(templates)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

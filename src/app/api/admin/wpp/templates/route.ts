import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'

// GET — busca templates aprovados da conta WhatsApp Business
export async function GET() {
  try {
    const wabaId = await getConfig('META_WABA_ID')
    const accessToken = await getConfig('META_ACCESS_TOKEN')
    if (!wabaId || !accessToken) {
      return NextResponse.json({ error: 'META_WABA_ID ou META_ACCESS_TOKEN não configurados' }, { status: 500 })
    }

    const res = await fetch(
      `${META_API_URL}/${wabaId}/message_templates?status=APPROVED&limit=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Meta API: ${err}` }, { status: 500 })
    }

    const json = await res.json()
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

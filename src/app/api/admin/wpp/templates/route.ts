import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import { createAdminClient } from '@/lib/supabase/admin'

const META_API_URL = 'https://graph.facebook.com/v21.0'

export async function GET(req: NextRequest) {
  try {
    const instanciaId = req.nextUrl.searchParams.get('instancia_id')

    let wabaId: string | null = null
    let accessToken: string | null = null

    if (instanciaId) {
      // Busca credenciais da instância específica
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (createAdminClient() as any)
        .from('whatsapp_instancias')
        .select('meta_waba_id, meta_access_token')
        .eq('id', instanciaId)
        .eq('tipo', 'meta')
        .single()
      wabaId = data?.meta_waba_id ?? null
      accessToken = data?.meta_access_token ?? null
    }

    // Fallback para config global se não veio da instância
    if (!wabaId) wabaId = await getConfig('META_WABA_ID')
    if (!accessToken) accessToken = await getConfig('META_ACCESS_TOKEN')

    if (!wabaId || !accessToken) {
      return NextResponse.json(
        { error: 'META_WABA_ID ou META_ACCESS_TOKEN não configurados' },
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

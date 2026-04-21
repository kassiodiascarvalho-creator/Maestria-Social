import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Body: { ids: string[] } — array de IDs na nova ordem
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { ids } = await req.json() as { ids: string[] }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids obrigatório' }, { status: 400 })
  }

  // Atualiza ordem em paralelo
  await Promise.all(
    ids.map((id, index) =>
      supabase.from('pipeline_etapas').update({ ordem: index }).eq('id', id)
    )
  )

  return NextResponse.json({ ok: true })
}

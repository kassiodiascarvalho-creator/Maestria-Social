import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Cria registro de resposta imediatamente quando o form é aberto
// Permite rastrear abandonos (concluido=false)
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = createAdminClient() as any

  const { data: form } = await db
    .from('forms')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'ativo')
    .single()

  if (!form) return NextResponse.json({ ok: false })

  const body = await req.json().catch(() => ({}))
  const { utm_source, utm_medium, utm_campaign, utm_term, utm_content } = body

  const { data } = await db.from('form_responses').insert({
    form_id: form.id,
    completude: 0,
    concluido: false,
    utm_source: utm_source ?? null,
    utm_medium: utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
    utm_term: utm_term ?? null,
    utm_content: utm_content ?? null,
  }).select('id').single()

  return NextResponse.json({ ok: true, response_id: data?.id ?? null })
}
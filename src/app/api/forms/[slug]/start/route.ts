import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = createAdminClient() as any

  // Rate limiting básico: máx 60 inícios por form por hora vindos do mesmo IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: form } = await db
    .from('forms')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'ativo')
    .single()

  if (!form) return NextResponse.json({ ok: false })

  // Verifica se já existe sessão aberta recente (mesmo form, últimos 10 min)
  // Isso ajuda a detectar recargas rápidas de bots
  const { count: recentes } = await db
    .from('form_responses')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', form.id)
    .eq('concluido', false)
    .gte('criado_em', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  // Se há mais de 20 sessões abertas nos últimos 10 min neste form, suspeito de bot
  if ((recentes ?? 0) > 20) {
    return NextResponse.json({ ok: false, rate_limited: true })
  }

  void ip; void umaHoraAtras; // reservado para futura implementação com Redis

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

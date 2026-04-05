import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EventoWebhook } from '@/types/database'

const EVENTOS: EventoWebhook[] = ['novo_lead', 'lead_qualificado', 'mensagem_recebida', 'status_atualizado']

async function ensureAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await ensureAuth()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('webhook_configs')
    .select('id, evento, url, secret, ativo, criado_em')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ webhooks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await ensureAuth()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const evento = body.evento as EventoWebhook | undefined
  const url = (body.url as string | undefined)?.trim()
  const secret = (body.secret as string | undefined)?.trim() || null

  if (!evento || !EVENTOS.includes(evento)) {
    return NextResponse.json({ error: 'evento inválido' }, { status: 400 })
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'url inválida' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('webhook_configs')
    .insert({
      evento,
      url,
      secret,
      ativo: true,
    })
    .select('id, evento, url, secret, ativo, criado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ webhook: data }, { status: 201 })
}

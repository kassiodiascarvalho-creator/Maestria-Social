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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureAuth()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const patch: {
    evento?: EventoWebhook
    url?: string
    secret?: string | null
    ativo?: boolean
  } = {}

  if (body.evento !== undefined) {
    if (!EVENTOS.includes(body.evento as EventoWebhook)) {
      return NextResponse.json({ error: 'evento inválido' }, { status: 400 })
    }
    patch.evento = body.evento as EventoWebhook
  }

  if (body.url !== undefined) {
    const url = (body.url as string).trim()
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'url inválida' }, { status: 400 })
    }
    patch.url = url
  }

  if (body.secret !== undefined) {
    const secret = (body.secret as string).trim()
    patch.secret = secret || null
  }

  if (body.ativo !== undefined) {
    if (typeof body.ativo !== 'boolean') {
      return NextResponse.json({ error: 'ativa deve ser boolean' }, { status: 400 })
    }
    patch.ativo = body.ativo as boolean
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('webhook_configs')
    .update(patch)
    .eq('id', id)
    .select('id, evento, url, secret, ativo, criado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ webhook: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureAuth()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('webhook_configs')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

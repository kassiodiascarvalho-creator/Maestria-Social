import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validarApiKey } from '@/lib/integracoes-auth'

function normalizarTelefone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

export async function GET(req: NextRequest) {
  const autorizado = await validarApiKey(req)
  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
  const updatedAfter = searchParams.get('updated_after')

  const supabase = createAdminClient()
  let query = supabase
    .from('leads')
    .select('*')
    .order('atualizado_em', { ascending: false })
    .limit(limit)

  if (updatedAfter) {
    query = query.gt('atualizado_em', updatedAfter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data ?? [] })
}

export async function POST(req: NextRequest) {
  const autorizado = await validarApiKey(req)
  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { nome, email, whatsapp, status_lead } = body as {
    nome?: string
    email?: string
    whatsapp?: string
    status_lead?: 'frio' | 'morno' | 'quente'
  }

  if (!nome?.trim() || !email?.trim() || !whatsapp?.trim()) {
    return NextResponse.json({ error: 'nome, email e whatsapp são obrigatórios' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const payload = {
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    whatsapp: normalizarTelefone(whatsapp),
    status_lead: status_lead ?? 'frio',
  }

  const { data, error } = await supabase
    .from('leads')
    .upsert(payload, { onConflict: 'email' })
    .select('id,email,whatsapp,status_lead,atualizado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: data }, { status: 200 })
}

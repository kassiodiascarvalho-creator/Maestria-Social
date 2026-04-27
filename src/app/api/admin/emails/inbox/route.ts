import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const status = req.nextUrl.searchParams.get('status') || ''

  let q = db
    .from('conversas_email')
    .select('*, leads(nome, telefone), email_campanhas(nome)')
    .order('ultima_mensagem_em', { ascending: false })
    .limit(200)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ conversas: data || [] })
}

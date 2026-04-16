import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const pessoaId = req.nextUrl.searchParams.get('pessoaId')
  if (!pessoaId) return NextResponse.json({ error: 'pessoaId obrigatório' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('agenda_campos')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .order('ordem')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { pessoaId, campos } = body
  if (!pessoaId || !Array.isArray(campos)) return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Apaga tudo e reinserine na ordem correta (simplifica o upsert)
  await admin.from('agenda_campos').delete().eq('pessoa_id', pessoaId)

  if (campos.length > 0) {
    const rows = campos.map((c: { nome: string; tipo: string; obrigatorio: boolean; fixo?: boolean }, idx: number) => ({
      pessoa_id: pessoaId,
      nome: c.nome,
      tipo: c.tipo ?? 'text',
      obrigatorio: c.obrigatorio ?? false,
      ordem: idx,
      fixo: c.fixo ?? false,
    }))
    const { error } = await admin.from('agenda_campos').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = await admin.from('agenda_campos').select('*').eq('pessoa_id', pessoaId).order('ordem')
  return NextResponse.json(data ?? [])
}

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
    .from('agenda_horarios')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .order('dia_semana')
    .order('inicio')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Salva horários completos (substitui todos os existentes)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { pessoaId, horarios } = await req.json()
  if (!pessoaId) return NextResponse.json({ error: 'pessoaId obrigatório' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Apaga todos os horários existentes e reinsere
  await admin.from('agenda_horarios').delete().eq('pessoa_id', pessoaId)

  if (horarios?.length > 0) {
    const inserts = horarios.map((h: { dia_semana: number; inicio: string; fim: string; ativo: boolean }) => ({
      pessoa_id: pessoaId,
      dia_semana: h.dia_semana,
      inicio: h.inicio,
      fim: h.fim,
      ativo: h.ativo,
    }))
    const { error } = await admin.from('agenda_horarios').insert(inserts)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

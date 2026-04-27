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

  if (error) {
    // Tabelas não criadas ainda
    const semTabela = error.message?.includes('does not exist') || error.code === '42P01'
    if (semTabela) return NextResponse.json({ error: 'SETUP_NEEDED', conversas: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Estatísticas de resposta
  const total = data?.length || 0
  const respondidas = data?.filter((c: { status: string }) => c.status === 'respondido').length || 0
  const taxaResposta = total > 0 ? ((respondidas / total) * 100).toFixed(1) : '0'

  return NextResponse.json({ conversas: data || [], stats: { total, respondidas, taxaResposta } })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ leadId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { leadId } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('conversas')
    .select('id, role, mensagem, criado_em, agente_id')
    .eq('lead_id', leadId)
    .order('criado_em', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

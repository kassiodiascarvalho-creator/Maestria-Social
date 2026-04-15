import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH — atualiza a etiqueta de um lead
// body: { etiqueta: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const { etiqueta } = await req.json() as { etiqueta: string }

  if (typeof etiqueta !== 'string' || !etiqueta.trim()) {
    return NextResponse.json({ error: 'etiqueta é obrigatória' }, { status: 400 })
  }

  const admin = createAdminClient()

  const updates: Record<string, unknown> = { etiqueta: etiqueta.trim() }

  // Quando humano assume manualmente, registra timestamp de atividade humana
  if (etiqueta.trim() !== 'ia_atendendo') {
    updates.ultima_atividade_humana = new Date().toISOString()
  } else {
    // Retorno ao IA: limpa o timestamp para o agente voltar a responder
    updates.ultima_atividade_humana = null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('leads').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

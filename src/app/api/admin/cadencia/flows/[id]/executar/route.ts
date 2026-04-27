import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processarFluxo, LEAD_FIELDS } from '@/lib/cadencia/engine'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// ─── POST: dispara execução para lista de leads ───────────────────────
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: flowId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const body = await req.json()
  const { lead_ids } = body as { lead_ids: string[] }

  if (!lead_ids?.length) return NextResponse.json({ error: 'lead_ids required' }, { status: 400 })

  // Busca nó de início
  const { data: startNode } = await db
    .from('cadencia_nodes').select('id')
    .eq('flow_id', flowId).eq('tipo', 'inicio').limit(1).maybeSingle()
  if (!startNode) return NextResponse.json({ error: 'Nenhum nó de início no fluxo' }, { status: 400 })

  const { data: edge } = await db
    .from('cadencia_edges').select('target_id')
    .eq('flow_id', flowId).eq('source_id', startNode.id).limit(1).maybeSingle()
  if (!edge?.target_id) return NextResponse.json({ error: 'Fluxo vazio — conecte o nó de início a um próximo passo' }, { status: 400 })

  const nextNodeId = edge.target_id as string

  let ok = 0, sem_whatsapp = 0
  for (const leadId of lead_ids) {
    const { data: lead } = await db.from('leads').select(LEAD_FIELDS).eq('id', leadId).maybeSingle()
    if (!lead) continue
    if (!lead.whatsapp) { sem_whatsapp++; continue }

    const { data: exec } = await db.from('cadencia_execucoes').insert({
      flow_id: flowId, lead_id: leadId, node_atual_id: nextNodeId,
      status: 'ativo', contexto: { lead },
    }).select('id').single()

    if (exec?.id) {
      await processarFluxo(db, exec.id, flowId, nextNodeId, lead)
      ok++
    }
  }

  return NextResponse.json({ ok, sem_whatsapp, total: lead_ids.length })
}

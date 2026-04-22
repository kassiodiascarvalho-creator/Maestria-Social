import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const [{ data: flow }, { data: nodes }, { data: edges }] = await Promise.all([
    db.from('cadencia_flows').select('*').eq('id', id).single(),
    db.from('cadencia_nodes').select('*').eq('flow_id', id).order('criado_em'),
    db.from('cadencia_edges').select('*').eq('flow_id', id).order('criado_em'),
  ])
  if (!flow) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  return NextResponse.json({ ...flow, nodes: nodes ?? [], edges: edges ?? [] })
}

// Salva fluxo completo (nome + todos os nodes + edges de uma vez)
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  const body = await req.json()
  const { nome, descricao, trigger_tipo, trigger_config, status, nodes, edges } = body

  await db.from('cadencia_flows').update({
    nome, descricao, trigger_tipo, trigger_config, status,
    atualizado_em: new Date().toISOString(),
  }).eq('id', id)

  // Replace all nodes: delete old → insert new
  await db.from('cadencia_nodes').delete().eq('flow_id', id)
  if (nodes?.length > 0) {
    await db.from('cadencia_nodes').insert(
      nodes.map((n: any) => ({
        id: n.id, flow_id: id, tipo: n.type, label: n.data?.label ?? n.type,
        config: n.data ?? {}, pos_x: n.position?.x ?? 0, pos_y: n.position?.y ?? 0,
      }))
    )
  }

  // Replace all edges
  await db.from('cadencia_edges').delete().eq('flow_id', id)
  if (edges?.length > 0) {
    await db.from('cadencia_edges').insert(
      edges.map((e: any) => ({
        id: e.id, flow_id: id,
        source_id: e.source, target_id: e.target,
        source_handle: e.sourceHandle ?? null,
        label: e.label ?? null,
      }))
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const db = createAdminClient() as any
  await db.from('cadencia_flows').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}

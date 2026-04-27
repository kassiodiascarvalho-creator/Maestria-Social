import { createAdminClient } from '@/lib/supabase/admin'
import { processarFluxo, LEAD_FIELDS } from './engine'

/**
 * Dispara todos os fluxos ativos cujo gatilho bate com `triggerTipos`.
 * Usa cadencia_flows.trigger_tipo (coluna indexada) em vez de escanear configs de nós.
 * Fire-and-forget: não bloqueia a resposta da API chamadora.
 */
export async function dispararFluxosPorGatilho(
  leadId: string,
  triggerTipos: string[],
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  // Busca fluxos ativos com gatilho correspondente
  const { data: flows } = await db
    .from('cadencia_flows')
    .select('id')
    .eq('status', 'ativo')
    .in('trigger_tipo', triggerTipos)

  if (!flows?.length) return 0

  // Busca dados completos do lead
  const { data: lead } = await db.from('leads').select(LEAD_FIELDS).eq('id', leadId).maybeSingle()
  if (!lead) return 0

  let started = 0
  for (const flow of flows as Array<{ id: string }>) {
    // Nó de início do fluxo
    const { data: startNode } = await db
      .from('cadencia_nodes')
      .select('id')
      .eq('flow_id', flow.id)
      .eq('tipo', 'inicio')
      .limit(1).maybeSingle()

    if (!startNode) continue

    // Primeiro nó após o início
    const { data: edge } = await db
      .from('cadencia_edges')
      .select('target_id')
      .eq('flow_id', flow.id)
      .eq('source_id', startNode.id)
      .limit(1).maybeSingle()

    if (!edge?.target_id) continue

    // Evita duplicar execução ativa para o mesmo fluxo + lead
    const { count } = await db
      .from('cadencia_execucoes')
      .select('id', { count: 'exact', head: true })
      .eq('flow_id', flow.id)
      .eq('lead_id', leadId)
      .eq('status', 'ativo')

    if ((count ?? 0) > 0) continue

    const { data: exec } = await db
      .from('cadencia_execucoes')
      .insert({
        flow_id: flow.id,
        lead_id: leadId,
        node_atual_id: edge.target_id,
        status: 'ativo',
        contexto: { lead },
      })
      .select('id').single()

    if (!exec?.id) continue

    await processarFluxo(db, exec.id, flow.id, edge.target_id, lead)
    started++
  }

  return started
}

import { createAdminClient } from '@/lib/supabase/admin'
import { processarFluxo, LEAD_FIELDS } from './engine'

/**
 * Dispara todos os fluxos ativos cujo gatilho de início bate com `triggerTipos`.
 * Chamado quando um lead é criado via formulário ou tag é adicionada.
 * Fire-and-forget: não bloqueia a resposta da API chamadora.
 */
export async function dispararFluxosPorGatilho(
  leadId: string,
  triggerTipos: string[],
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  // Busca todos os nós de início de fluxos ativos
  const { data: inicioNodes } = await db
    .from('cadencia_nodes')
    .select('id, flow_id, config')
    .eq('tipo', 'inicio')

  if (!inicioNodes?.length) return 0

  // Filtra pelos gatilhos que nos interessam
  const matchingNodes = (inicioNodes as Array<{ id: string; flow_id: string; config: Record<string, unknown> }>)
    .filter(n => triggerTipos.includes(String(n.config?.trigger_tipo ?? 'manual')))

  if (!matchingNodes.length) return 0

  // Verifica quais fluxos estão ativos
  const flowIds = [...new Set(matchingNodes.map(n => n.flow_id))]
  const { data: flows } = await db
    .from('cadencia_flows')
    .select('id')
    .in('id', flowIds)
    .eq('status', 'ativo')

  if (!flows?.length) return 0

  const activeFlowIds = new Set((flows as Array<{ id: string }>).map(f => f.id))
  const activeNodes   = matchingNodes.filter(n => activeFlowIds.has(n.flow_id))

  // Busca dados completos do lead
  const { data: lead } = await db.from('leads').select(LEAD_FIELDS).eq('id', leadId).maybeSingle()
  if (!lead) return 0

  let started = 0
  for (const inicioNode of activeNodes) {
    // Primeiro nó após o início
    const { data: edge } = await db
      .from('cadencia_edges')
      .select('target_id')
      .eq('flow_id', inicioNode.flow_id)
      .eq('source_id', inicioNode.id)
      .limit(1).maybeSingle()

    if (!edge?.target_id) continue

    // Evita duplicar execução ativa para o mesmo fluxo + lead
    const { count } = await db
      .from('cadencia_execucoes')
      .select('id', { count: 'exact', head: true })
      .eq('flow_id', inicioNode.flow_id)
      .eq('lead_id', leadId)
      .eq('status', 'ativo')

    if ((count ?? 0) > 0) continue

    const { data: exec } = await db
      .from('cadencia_execucoes')
      .insert({
        flow_id: inicioNode.flow_id,
        lead_id: leadId,
        node_atual_id: edge.target_id,
        status: 'ativo',
        contexto: { lead },
      })
      .select('id').single()

    if (!exec?.id) continue

    await processarFluxo(db, exec.id, inicioNode.flow_id, edge.target_id, lead)
    started++
  }

  return started
}

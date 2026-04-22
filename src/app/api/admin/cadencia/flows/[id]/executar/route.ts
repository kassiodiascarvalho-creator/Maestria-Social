import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarViaBaileys } from '@/lib/baileys'
import { enviarMensagemWhatsApp } from '@/lib/meta'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// ─── Execution engine ─────────────────────────────────────────────────
async function getNextNodeId(db: any, flowId: string, nodeId: string, handle?: string) {
  const q = db.from('cadencia_edges')
    .select('target_id')
    .eq('flow_id', flowId)
    .eq('source_id', nodeId)
  if (handle) q.eq('source_handle', handle)
  const { data } = await q.limit(1).maybeSingle()
  return data?.target_id ?? null
}

async function sendWhatsApp(telefone: string, texto: string) {
  const modo = await getConfig('WHATSAPP_MODE')
  const instanciaId = (await getConfig('BAILEYS_INSTANCIA_ID')) || '1'
  if (modo === 'baileys') await enviarViaBaileys(telefone, texto, instanciaId)
  else await enviarMensagemWhatsApp(telefone, texto)
}

function evaluateCondition(config: any, contexto: any): boolean {
  const { campo, operador, valor } = config
  const leadVal = String(contexto?.lead?.[campo] ?? contexto?.[campo] ?? '')
  switch (operador) {
    case 'igual':    return leadVal.toLowerCase() === valor?.toLowerCase()
    case 'contem':   return leadVal.toLowerCase().includes(valor?.toLowerCase())
    case 'existe':   return leadVal.length > 0
    case 'nao_existe': return leadVal.length === 0
    default:         return false
  }
}

function personalizar(texto: string, contexto: any) {
  const lead = contexto?.lead ?? {}
  return texto
    .replace(/\{nome\}/gi,      lead.nome      ?? '')
    .replace(/\{email\}/gi,     lead.email     ?? '')
    .replace(/\{whatsapp\}/gi,  lead.whatsapp  ?? '')
    .replace(/\{origem\}/gi,    lead.origem    ?? '')
}

async function processFlow(
  db: any, execId: string, flowId: string,
  startNodeId: string, contexto: any
) {
  const MAX_STEPS = 50
  let currentNodeId: string | null = startNodeId
  let steps = 0

  while (currentNodeId && steps < MAX_STEPS) {
    steps++
    const { data: node } = await db.from('cadencia_nodes').select('*').eq('id', currentNodeId).maybeSingle()
    if (!node) break

    await db.from('cadencia_execucoes').update({
      node_atual_id: currentNodeId, atualizado_em: new Date().toISOString()
    }).eq('id', execId)

    switch (node.tipo) {
      case 'mensagem': {
        const lead = contexto?.lead
        if (lead?.whatsapp) {
          const texto = personalizar(node.config?.texto ?? '', contexto)
          await sendWhatsApp(lead.whatsapp, texto).catch(() => {})
        }
        currentNodeId = await getNextNodeId(db, flowId, currentNodeId)
        break
      }
      case 'aguardar': {
        const nextId = await getNextNodeId(db, flowId, currentNodeId)
        if (!nextId) {
          await db.from('cadencia_execucoes').update({ status: 'concluido', atualizado_em: new Date().toISOString() }).eq('id', execId)
          return
        }
        const { quantidade = 1, unidade = 'horas' } = node.config ?? {}
        const ms: Record<string, number> = { minutos: 60e3, horas: 3600e3, dias: 86400e3 }
        const agendadoPara = new Date(Date.now() + quantidade * (ms[unidade] ?? 3600e3))
        await db.from('cadencia_agendamentos').insert({
          execucao_id: execId, flow_id: flowId,
          lead_id: contexto?.lead?.id, node_id: nextId,
          agendado_para: agendadoPara.toISOString(),
        })
        await db.from('cadencia_execucoes').update({
          node_atual_id: nextId, status: 'ativo', atualizado_em: new Date().toISOString()
        }).eq('id', execId)
        return
      }
      case 'condicao': {
        const result = evaluateCondition(node.config, contexto)
        currentNodeId = await getNextNodeId(db, flowId, currentNodeId, result ? 'sim' : 'nao')
        break
      }
      case 'tag': {
        const tag = node.config?.tag
        if (tag && contexto?.lead?.id) {
          const { data: leadRow } = await db.from('leads').select('tags').eq('id', contexto.lead.id).maybeSingle()
          const tags: string[] = leadRow?.tags ?? []
          if (!tags.includes(tag)) {
            await db.from('leads').update({ tags: [...tags, tag] }).eq('id', contexto.lead.id)
          }
        }
        currentNodeId = await getNextNodeId(db, flowId, currentNodeId)
        break
      }
      case 'agente_ia': {
        // Marca lead para IA assumir na próxima mensagem
        if (contexto?.lead?.id) {
          await db.from('leads').update({ modo_atendimento: 'ia' }).eq('id', contexto.lead.id).catch(() => {})
        }
        currentNodeId = await getNextNodeId(db, flowId, currentNodeId)
        break
      }
      case 'fim':
      default:
        await db.from('cadencia_execucoes').update({ status: 'concluido', atualizado_em: new Date().toISOString() }).eq('id', execId)
        return
    }
  }
  await db.from('cadencia_execucoes').update({ status: 'concluido', atualizado_em: new Date().toISOString() }).eq('id', execId)
}

// ─── POST: trigger execution for a list of leads ──────────────────────
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: flowId } = await params
  const db = createAdminClient() as any
  const body = await req.json()
  const { lead_ids } = body as { lead_ids: string[] }

  if (!lead_ids?.length) return NextResponse.json({ error: 'lead_ids required' }, { status: 400 })

  const { data: flow } = await db.from('cadencia_flows').select('status').eq('id', flowId).maybeSingle()
  if (!flow) return NextResponse.json({ error: 'flow not found' }, { status: 404 })

  // Find the start node
  const { data: startNode } = await db.from('cadencia_nodes').select('id')
    .eq('flow_id', flowId).eq('tipo', 'inicio').limit(1).maybeSingle()
  if (!startNode) return NextResponse.json({ error: 'Nenhum nó de início encontrado' }, { status: 400 })

  const nextNodeId = await getNextNodeId(db, flowId, startNode.id)
  if (!nextNodeId) return NextResponse.json({ error: 'Fluxo vazio após o início' }, { status: 400 })

  let ok = 0
  for (const leadId of lead_ids) {
    const { data: lead } = await db.from('leads').select('id, nome, email, whatsapp, origem, tags').eq('id', leadId).maybeSingle()
    if (!lead?.whatsapp) continue

    const { data: exec } = await db.from('cadencia_execucoes').insert({
      flow_id: flowId, lead_id: leadId, node_atual_id: nextNodeId,
      status: 'ativo', contexto: { lead },
    }).select('id').single()

    await processFlow(db, exec.id, flowId, nextNodeId, { lead })
    ok++
  }

  // Increment counter
  await db.rpc('increment_cadencia_execucoes', { flow_id_param: flowId }).catch(() =>
    db.from('cadencia_flows').update({ total_execucoes: ok }).eq('id', flowId)
  )

  return NextResponse.json({ ok, total: lead_ids.length })
}

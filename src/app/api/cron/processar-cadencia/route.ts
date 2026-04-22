import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarViaBaileys } from '@/lib/baileys'
import { enviarMensagemWhatsApp } from '@/lib/meta'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

function personalizar(texto: string, lead: any) {
  return texto
    .replace(/\{nome\}/gi,     lead?.nome     ?? '')
    .replace(/\{email\}/gi,    lead?.email    ?? '')
    .replace(/\{whatsapp\}/gi, lead?.whatsapp ?? '')
    .replace(/\{origem\}/gi,   lead?.origem   ?? '')
}

async function enviar(telefone: string, texto: string) {
  const modo = await getConfig('WHATSAPP_MODE')
  const instId = (await getConfig('BAILEYS_INSTANCIA_ID')) || '1'
  if (modo === 'baileys') await enviarViaBaileys(telefone, texto, instId)
  else await enviarMensagemWhatsApp(telefone, texto)
}

async function getNextNodeId(db: any, flowId: string, nodeId: string, handle?: string) {
  const q = db.from('cadencia_edges').select('target_id').eq('flow_id', flowId).eq('source_id', nodeId)
  if (handle) q.eq('source_handle', handle)
  const { data } = await q.limit(1).maybeSingle()
  return data?.target_id ?? null
}

async function avancarExecucao(db: any, execId: string, flowId: string, nodeId: string, lead: any) {
  const MAX = 20
  let currentId: string | null = nodeId
  let steps = 0

  while (currentId && steps < MAX) {
    steps++
    const { data: node } = await db.from('cadencia_nodes').select('*').eq('id', currentId).maybeSingle()
    if (!node) break

    await db.from('cadencia_execucoes').update({ node_atual_id: currentId, atualizado_em: new Date().toISOString() }).eq('id', execId)

    switch (node.tipo) {
      case 'mensagem': {
        if (lead?.whatsapp) {
          const texto = personalizar(node.config?.texto ?? '', lead)
          await enviar(lead.whatsapp, texto).catch(() => {})
        }
        currentId = await getNextNodeId(db, flowId, currentId)
        break
      }
      case 'aguardar': {
        const nextId = await getNextNodeId(db, flowId, currentId)
        if (!nextId) { await db.from('cadencia_execucoes').update({ status: 'concluido' }).eq('id', execId); return }
        const { quantidade = 1, unidade = 'horas' } = node.config ?? {}
        const ms: Record<string, number> = { minutos: 60e3, horas: 3600e3, dias: 86400e3 }
        const agendadoPara = new Date(Date.now() + quantidade * (ms[unidade] ?? 3600e3))
        await db.from('cadencia_agendamentos').insert({ execucao_id: execId, flow_id: flowId, lead_id: lead?.id, node_id: nextId, agendado_para: agendadoPara.toISOString() })
        return
      }
      case 'tag': {
        const tag = node.config?.tag
        if (tag && lead?.id) {
          const { data: l } = await db.from('leads').select('tags').eq('id', lead.id).maybeSingle()
          const tags: string[] = l?.tags ?? []
          if (!tags.includes(tag)) await db.from('leads').update({ tags: [...tags, tag] }).eq('id', lead.id)
        }
        currentId = await getNextNodeId(db, flowId, currentId)
        break
      }
      case 'condicao': {
        const { campo, operador, valor } = node.config ?? {}
        const v = String(lead?.[campo] ?? '')
        const ok = operador === 'igual' ? v.toLowerCase() === valor?.toLowerCase()
          : operador === 'contem' ? v.toLowerCase().includes(valor?.toLowerCase() ?? '')
          : operador === 'existe' ? v.length > 0
          : v.length === 0
        currentId = await getNextNodeId(db, flowId, currentId, ok ? 'sim' : 'nao')
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

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') ?? new URL(req.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = createAdminClient() as any
  const agora = new Date().toISOString()

  // Claim up to 20 pending agendamentos atomically
  const { data: pendentes } = await db
    .from('cadencia_agendamentos')
    .select('id, execucao_id, flow_id, lead_id, node_id')
    .eq('status', 'pendente')
    .lte('agendado_para', agora)
    .lt('tentativas', 3)
    .limit(20)

  if (!pendentes?.length) return NextResponse.json({ processadas: 0 })

  let ok = 0, fail = 0
  for (const ag of pendentes) {
    // Atomic claim
    const { data: claimed } = await db.from('cadencia_agendamentos')
      .update({ status: 'processado', tentativas: ag.tentativas + 1 })
      .eq('id', ag.id).eq('status', 'pendente')
      .select('id').maybeSingle()
    if (!claimed) continue

    try {
      const { data: lead } = await db.from('leads').select('id,nome,email,whatsapp,origem,tags').eq('id', ag.lead_id).maybeSingle()
      await avancarExecucao(db, ag.execucao_id, ag.flow_id, ag.node_id, lead)
      ok++
    } catch (e) {
      await db.from('cadencia_agendamentos').update({ status: 'erro', erro: String(e) }).eq('id', ag.id)
      fail++
    }
  }

  return NextResponse.json({ processadas: ok + fail, ok, fail })
}

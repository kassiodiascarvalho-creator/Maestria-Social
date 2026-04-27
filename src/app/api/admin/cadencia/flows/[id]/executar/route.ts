import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarViaBaileys, enviarMidiaViaBaileys } from '@/lib/baileys'
import { enviarMensagemWhatsApp } from '@/lib/meta'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// ─── Helpers ──────────────────────────────────────────────────────────
async function getNextNodeId(db: any, flowId: string, nodeId: string, handle?: string) {
  let q = db.from('cadencia_edges').select('target_id').eq('flow_id', flowId).eq('source_id', nodeId)
  if (handle) q = q.eq('source_handle', handle)
  const { data } = await q.limit(1).maybeSingle()
  return data?.target_id ?? null
}

function personalizar(texto: string, lead: Record<string, unknown>): string {
  return (texto ?? '')
    .replace(/\{nome\}/gi,     String(lead?.nome     ?? ''))
    .replace(/\{email\}/gi,    String(lead?.email    ?? ''))
    .replace(/\{whatsapp\}/gi, String(lead?.whatsapp ?? ''))
    .replace(/\{origem\}/gi,   String(lead?.origem   ?? ''))
    .replace(/\{utm_source\}/gi, String((lead?.utm_source ?? '')))
}

async function enviarMensagem(telefone: string, config: Record<string, unknown>, lead: Record<string, unknown>) {
  const modo = await getConfig('WHATSAPP_MODE')
  const instId = (await getConfig('BAILEYS_INSTANCIA_ID')) || '1'
  const tipo = String(config.tipo ?? 'texto')
  const texto = personalizar(String(config.texto ?? ''), lead)
  const legenda = personalizar(String(config.legenda ?? config.texto ?? ''), lead)
  const urlMidia = String(config.url_midia ?? '')

  if (tipo === 'texto' || !urlMidia) {
    if (modo === 'baileys') await enviarViaBaileys(telefone, texto, instId)
    else await enviarMensagemWhatsApp(telefone, texto)
    return
  }

  const tipoMidia = tipo === 'imagem' ? 'image'
    : tipo === 'video' ? 'video'
    : tipo === 'audio' ? 'audio'
    : 'document'

  if (modo === 'baileys') {
    await enviarMidiaViaBaileys(telefone, tipoMidia as any, urlMidia, legenda, '', instId)
  } else {
    await enviarMensagemWhatsApp(telefone, legenda || texto)
  }
}

function avaliarCondicao(config: Record<string, unknown>, lead: Record<string, unknown>): boolean {
  const { campo, operador, valor } = config
  const leadTags: string[] = (lead?.tags as string[]) ?? []
  let leadVal = ''

  if (campo === 'tags') {
    // tags é array — verifica se contém
    return operador === 'contem' || operador === 'existe'
      ? leadTags.some(t => t.toLowerCase().includes(String(valor ?? '').toLowerCase()) || !valor)
      : !leadTags.length
  }

  leadVal = String(lead?.[String(campo)] ?? '')

  // Operadores numéricos — usados para score_email, qs_total, etc.
  const leadNum = parseFloat(leadVal)
  const valorNum = parseFloat(String(valor ?? '0'))

  switch (operador) {
    case 'igual':        return leadVal.toLowerCase() === String(valor ?? '').toLowerCase()
    case 'contem':       return leadVal.toLowerCase().includes(String(valor ?? '').toLowerCase())
    case 'nao_contem':   return !leadVal.toLowerCase().includes(String(valor ?? '').toLowerCase())
    case 'existe':       return leadVal.trim().length > 0
    case 'nao_existe':   return leadVal.trim().length === 0
    case 'maior_que':    return !isNaN(leadNum) && leadNum > valorNum
    case 'menor_que':    return !isNaN(leadNum) && leadNum < valorNum
    case 'maior_igual':  return !isNaN(leadNum) && leadNum >= valorNum
    case 'menor_igual':  return !isNaN(leadNum) && leadNum <= valorNum
    default:             return false
  }
}

// ─── Engine principal ─────────────────────────────────────────────────
async function processarFluxo(
  db: any, execId: string, flowId: string,
  startNodeId: string, lead: Record<string, unknown>
) {
  const MAX_STEPS = 60
  let currentNodeId: string | null = startNodeId
  let steps = 0

  while (currentNodeId && steps < MAX_STEPS) {
    steps++

    const { data: node } = await db.from('cadencia_nodes').select('*').eq('id', currentNodeId).maybeSingle()
    if (!node) break

    await db.from('cadencia_execucoes').update({
      node_atual_id: currentNodeId, atualizado_em: new Date().toISOString(),
    }).eq('id', execId)

    const cfg = (node.config ?? {}) as Record<string, unknown>

    switch (node.tipo) {

      case 'mensagem': {
        const telefone = String(lead?.whatsapp ?? '')
        if (telefone) await enviarMensagem(telefone, cfg, lead).catch(() => {})
        currentNodeId = await getNextNodeId(db, flowId, currentNodeId)
        break
      }

      case 'email': {
        const emailLead = String(lead?.email ?? '')
        if (emailLead) {
          const { enviarEmail } = await import('@/lib/email/enviar')
          const assunto = personalizar(String(cfg.assunto ?? '(sem assunto)'), lead)
          const html    = personalizar(String(cfg.html ?? cfg.texto ?? ''), lead)
          const texto   = personalizar(String(cfg.texto ?? ''), lead)
          await enviarEmail({ para: emailLead, assunto, html, texto }).catch(() => {})
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
        const { quantidade = 1, unidade = 'horas' } = cfg
        const ms: Record<string, number> = { minutos: 60e3, horas: 3600e3, dias: 86400e3 }
        const agendadoPara = new Date(Date.now() + Number(quantidade) * (ms[String(unidade)] ?? 3600e3))
        await db.from('cadencia_agendamentos').insert({
          execucao_id: execId, flow_id: flowId,
          lead_id: lead?.id, node_id: nextId,
          agendado_para: agendadoPara.toISOString(),
        })
        await db.from('cadencia_execucoes').update({ node_atual_id: nextId, status: 'ativo', atualizado_em: new Date().toISOString() }).eq('id', execId)
        return
      }

      case 'condicao': {
        const resultado = avaliarCondicao(cfg, lead)
        currentNodeId = await getNextNodeId(db, flowId, currentNodeId, resultado ? 'sim' : 'nao')
        break
      }

      case 'tag': {
        const tag = String(cfg.tag ?? '').trim()
        if (tag && lead?.id) {
          const { data: l } = await db.from('leads').select('tags').eq('id', lead.id).maybeSingle()
          const tags: string[] = (l?.tags ?? []) as string[]
          if (!tags.includes(tag)) {
            await db.from('leads').update({ tags: [...tags, tag] }).eq('id', lead.id).catch(() => {})
          }
        }
        currentNodeId = await getNextNodeId(db, flowId, currentNodeId)
        break
      }

      case 'agente_ia': {
        if (lead?.id) {
          await db.from('leads').update({ modo_atendimento: 'ia' }).eq('id', lead.id).catch(() => {})
          // Cria uma observação no CRM para o agente
          const instrucoes = String(cfg.instrucoes ?? '')
          if (instrucoes) {
            await db.from('crm_observacoes').insert({
              lead_id: lead.id,
              texto: `[Cadência] ${instrucoes}`,
              tipo: 'automatico',
            }).catch(() => {})
          }
        }
        currentNodeId = await getNextNodeId(db, flowId, currentNodeId)
        break
      }

      case 'webhook': {
        const url = String(cfg.url ?? '')
        const metodo = String(cfg.metodo ?? 'POST').toUpperCase()
        if (url) {
          await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Maestria-Social/1.0' },
            body: JSON.stringify({
              lead, flow_id: flowId, execucao_id: execId,
              node_id: currentNodeId, timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(10000),
          }).catch(() => {})
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

// ─── POST: dispara execução para lista de leads ───────────────────────
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: flowId } = await params
  const db = createAdminClient() as any
  const body = await req.json()
  const { lead_ids } = body as { lead_ids: string[] }

  if (!lead_ids?.length) return NextResponse.json({ error: 'lead_ids required' }, { status: 400 })

  // Busca nó de início e o próximo nó
  const { data: startNode } = await db.from('cadencia_nodes').select('id')
    .eq('flow_id', flowId).eq('tipo', 'inicio').limit(1).maybeSingle()
  if (!startNode) return NextResponse.json({ error: 'Nenhum nó de início no fluxo' }, { status: 400 })

  const nextNodeId = await getNextNodeId(db, flowId, startNode.id)
  if (!nextNodeId) return NextResponse.json({ error: 'Fluxo vazio — conecte o nó de início a um próximo passo' }, { status: 400 })

  let ok = 0; let sem_whatsapp = 0
  for (const leadId of lead_ids) {
    const { data: lead } = await db.from('leads').select('id, nome, email, whatsapp, origem, utm_source, tags').eq('id', leadId).maybeSingle()
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

  // Incrementa contador do fluxo
  await db.from('cadencia_flows').update({
    total_execucoes: db.rpc ? undefined : ok,
    atualizado_em: new Date().toISOString(),
  }).eq('id', flowId).catch(() => {})

  return NextResponse.json({ ok, sem_whatsapp, total: lead_ids.length })
}

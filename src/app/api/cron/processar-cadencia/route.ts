import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processarFluxo, LEAD_FIELDS } from '@/lib/cadencia/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
    ?? new URL(req.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const agora = new Date().toISOString()

  // Busca até 20 agendamentos pendentes cujo horário já chegou
  const { data: pendentes } = await db
    .from('cadencia_agendamentos')
    .select('id, execucao_id, flow_id, lead_id, node_id, tentativas')
    .eq('status', 'pendente')
    .lte('agendado_para', agora)
    .lt('tentativas', 3)
    .limit(20)

  if (!pendentes?.length) return NextResponse.json({ processadas: 0 })

  let ok = 0, fail = 0

  for (const ag of pendentes) {
    // Claim atômico — evita processamento duplo em caso de cron sobreposto
    const { data: claimed } = await db
      .from('cadencia_agendamentos')
      .update({ status: 'processado', tentativas: (ag.tentativas ?? 0) + 1 })
      .eq('id', ag.id).eq('status', 'pendente')
      .select('id').maybeSingle()

    if (!claimed) continue

    try {
      // Busca dados frescos do lead para avaliar condições com estado atual
      const { data: lead } = await db
        .from('leads').select(LEAD_FIELDS).eq('id', ag.lead_id).maybeSingle()

      if (!lead) {
        await db.from('cadencia_agendamentos').update({ status: 'erro', erro: 'lead não encontrado' }).eq('id', ag.id)
        fail++
        continue
      }

      await processarFluxo(db, ag.execucao_id, ag.flow_id, ag.node_id, lead)
      ok++
    } catch (e) {
      console.error('[cron:cadencia]', ag.id, e)
      await db.from('cadencia_agendamentos')
        .update({ status: 'erro', erro: String(e) })
        .eq('id', ag.id)
      fail++
    }
  }

  return NextResponse.json({ processadas: ok + fail, ok, fail })
}

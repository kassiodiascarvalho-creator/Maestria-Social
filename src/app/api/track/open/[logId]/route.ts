import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GIF transparente 1x1
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

type P = { params: Promise<{ logId: string }> }

async function atualizarLead(db: any, leadId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: lead } = await db
    .from('leads')
    .select('score_email, status_lead, tags')
    .eq('id', leadId)
    .single()
  if (!lead) return

  const tags: string[] = lead.tags ?? []
  const novoScore = (lead.score_email ?? 0) + 5
  // Sobe de frio → morno ao abrir um email
  const novoStatus = lead.status_lead === 'frio' ? 'morno' : lead.status_lead

  await db.from('leads').update({
    score_email: novoScore,
    status_lead: novoStatus,
    tags: tags.includes('abriu_email') ? tags : [...tags, 'abriu_email'],
    atualizado_em: new Date().toISOString(),
  }).eq('id', leadId)
}

export async function GET(req: NextRequest, { params }: P) {
  const { logId } = await params

  if (!logId.startsWith('preview-')) {
    const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const agora = new Date().toISOString()
    const ua = req.headers.get('user-agent') || ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || ''

    const { data: log } = await db
      .from('email_logs')
      .select('id, campanha_id, lead_id, total_aberturas, status')
      .eq('id', logId)
      .single()

    if (log) {
      const primeiraAbertura = log.status !== 'aberto' && log.status !== 'clicado'

      const updates: Record<string, unknown> = { total_aberturas: (log.total_aberturas || 0) + 1 }
      if (log.status === 'enviando' || log.status === 'entregue') {
        updates.status = 'aberto'
        updates.aberto_em = agora
      }
      await db.from('email_logs').update(updates).eq('id', logId)

      await db.from('email_eventos').insert({
        log_id: logId, tipo: 'aberto', ip, user_agent: ua,
      }).catch(() => null)

      if (primeiraAbertura) {
        // Incrementa contador da campanha
        const { data: camp } = await db
          .from('email_campanhas').select('total_abertos').eq('id', log.campanha_id).single()
        await db.from('email_campanhas')
          .update({ total_abertos: (camp?.total_abertos ?? 0) + 1 })
          .eq('id', log.campanha_id)

        // Score + tag + status do lead
        if (log.lead_id) await atualizarLead(db, log.lead_id)
      }
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

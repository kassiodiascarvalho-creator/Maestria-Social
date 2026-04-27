import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type P = { params: Promise<{ logId: string }> }

async function atualizarLead(db: any, leadId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: lead } = await db
    .from('leads')
    .select('score_email, status_lead, tags')
    .eq('id', leadId)
    .single()
  if (!lead) return

  const tags: string[] = lead.tags ?? []
  const novoScore = (lead.score_email ?? 0) + 10
  // Clique sempre sobe para quente
  const novasTags = [...new Set([...tags, 'abriu_email', 'clicou_email'])]

  await db.from('leads').update({
    score_email: novoScore,
    status_lead: 'quente',
    tags: novasTags,
    atualizado_em: new Date().toISOString(),
  }).eq('id', leadId)
}

export async function GET(req: NextRequest, { params }: P) {
  const { logId } = await params
  const url = req.nextUrl.searchParams.get('url') || '/'

  if (!logId.startsWith('preview-')) {
    try {
      const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
      const agora = new Date().toISOString()
      const ua = req.headers.get('user-agent') || ''
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || ''

      const { data: log } = await db
        .from('email_logs')
        .select('id, campanha_id, lead_id, total_cliques, status')
        .eq('id', logId).single()

      if (log) {
        const primeiroClique = log.status !== 'clicado'

        const updates: Record<string, unknown> = { total_cliques: (log.total_cliques || 0) + 1 }
        if (primeiroClique) {
          updates.status = 'clicado'
          updates.clicado_em = agora

          // Incrementa contador da campanha
          const { data: camp } = await db
            .from('email_campanhas').select('total_cliques').eq('id', log.campanha_id).single()
          await db.from('email_campanhas')
            .update({ total_cliques: (camp?.total_cliques ?? 0) + 1 })
            .eq('id', log.campanha_id)

          // Score + tags + status do lead
          if (log.lead_id) await atualizarLead(db, log.lead_id)
        }

        await db.from('email_logs').update(updates).eq('id', logId)
        await db.from('email_eventos').insert({ log_id: logId, tipo: 'clicado', url, ip, user_agent: ua }).catch(() => null)
      }
    } catch { /* não bloqueia o redirect */ }
  }

  return NextResponse.redirect(url, { status: 302 })
}

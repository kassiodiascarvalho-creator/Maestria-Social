import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type P = { params: Promise<{ logId: string }> }

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
        .select('id, campanha_id, total_cliques, status')
        .eq('id', logId).single()

      if (log) {
        const updates: Record<string, unknown> = { total_cliques: (log.total_cliques || 0) + 1 }
        if (log.status !== 'clicado') {
          updates.status = 'clicado'
          updates.clicado_em = agora
          // Incrementa total_cliques na campanha (só no primeiro clique)
          const { data: camp } = await db
            .from('email_campanhas')
            .select('total_cliques')
            .eq('id', log.campanha_id)
            .single()
          await db
            .from('email_campanhas')
            .update({ total_cliques: (camp?.total_cliques ?? 0) + 1 })
            .eq('id', log.campanha_id)
        }
        await db.from('email_logs').update(updates).eq('id', logId)
        await db.from('email_eventos').insert({ log_id: logId, tipo: 'clicado', url, ip, user_agent: ua }).catch(() => null)
      }
    } catch { /* não bloqueia o redirect */ }
  }

  return NextResponse.redirect(url, { status: 302 })
}

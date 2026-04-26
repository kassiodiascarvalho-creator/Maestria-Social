import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GIF transparente 1x1
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

type P = { params: Promise<{ logId: string }> }

export async function GET(req: NextRequest, { params }: P) {
  const { logId } = await params

  // Não rastrear previews
  if (!logId.startsWith('preview-')) {
    const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const agora = new Date().toISOString()
    const ua = req.headers.get('user-agent') || ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || ''

    // Atualiza log (só marca aberto se ainda não foi)
    const { data: log } = await db
      .from('email_logs')
      .select('id, campanha_id, total_aberturas, status')
      .eq('id', logId)
      .single()

    if (log) {
      const updates: Record<string, unknown> = { total_aberturas: (log.total_aberturas || 0) + 1 }
      if (log.status === 'enviando' || log.status === 'entregue') {
        updates.status = 'aberto'
        updates.aberto_em = agora
      }
      await db.from('email_logs').update(updates).eq('id', logId)

      // Registra evento
      await db.from('email_eventos').insert({
        log_id: logId, tipo: 'aberto', ip, user_agent: ua,
      })

      // Atualiza total_abertos na campanha (incrementa)
      if (log.status !== 'aberto' && log.status !== 'clicado') {
        await db.rpc('increment_col', { tbl: 'email_campanhas', col: 'total_abertos', row_id: log.campanha_id })
          .catch(() => null)
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

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, data } = body

  const resendId: string = data?.email_id || data?.id
  if (!resendId) return NextResponse.json({ ok: true })

  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: log } = await db
    .from('email_logs')
    .select('id, campanha_id, status')
    .eq('resend_id', resendId)
    .single()

  if (!log) return NextResponse.json({ ok: true })

  const agora = new Date().toISOString()

  const mapa: Record<string, { status: string; campo: string; col_campanha: string }> = {
    'email.delivered':  { status: 'entregue',  campo: 'entregue_em',  col_campanha: 'total_entregues' },
    'email.opened':     { status: 'aberto',     campo: 'aberto_em',   col_campanha: 'total_abertos' },
    'email.clicked':    { status: 'clicado',    campo: 'clicado_em',  col_campanha: 'total_cliques' },
    'email.bounced':    { status: 'bounced',    campo: 'bounced_em',  col_campanha: 'total_bounced' },
    'email.complained': { status: 'spam',       campo: 'bounced_em',  col_campanha: 'total_spam' },
  }

  const info = mapa[type]
  if (!info) return NextResponse.json({ ok: true })

  // Só avança status (nunca regride)
  const ordem = ['enviando','entregue','aberto','clicado','bounced','spam','erro']
  const rankAtual = ordem.indexOf(log.status)
  const rankNovo = ordem.indexOf(info.status)
  const updates: Record<string, unknown> = { [info.campo]: agora }
  if (rankNovo > rankAtual) updates.status = info.status

  await db.from('email_logs').update(updates).eq('id', log.id)

  // Evento de tracking
  const tipoEvento = type.split('.')[1] as string
  const tiposValidos = ['aberto','clicado','bounced','spam','entregue']
  if (tiposValidos.includes(tipoEvento)) {
    await db.from('email_eventos').insert({
      log_id: log.id, tipo: tipoEvento === 'complained' ? 'spam' : tipoEvento,
      url: data?.click?.link || null,
    })
  }

  // Atualiza bounced/spam na lista de contatos
  if (type === 'email.bounced' || type === 'email.complained') {
    const novoStatus = type === 'email.bounced' ? 'bounced' : 'spam'
    await db.from('email_lista_contatos')
      .update({ status: novoStatus })
      .eq('email', data?.to?.[0] || data?.email || '')
  }

  return NextResponse.json({ ok: true })
}

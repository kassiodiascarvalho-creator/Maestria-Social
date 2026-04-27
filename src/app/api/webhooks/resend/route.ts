import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, data } = body

  // ── Inbound (lead responde ao e-mail) ─────────────────────────
  // Resend envia estrutura plana para inbound (sem type/data wrapper)
  const isInbound = type === 'email.inbound' || (!type && body.from && body.subject)
  if (isInbound) {
    const payload = data ?? body
    const emailFrom: string = typeof payload.from === 'string'
      ? payload.from.replace(/.*<(.+)>/, '$1').trim()
      : (payload.from as string) || ''
    const assunto: string = payload.subject || '(sem assunto)'
    const corpoHtml: string = payload.html || ''
    const corpoTexto: string = payload.text || ''

    if (emailFrom) {
      const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
      // Encontra conversa mais recente para este e-mail de lead
      const { data: conversa } = await db
        .from('conversas_email')
        .select('id, total_mensagens, nao_lidas')
        .eq('email_lead', emailFrom)
        .neq('status', 'fechado')
        .order('ultima_mensagem_em', { ascending: false })
        .limit(1)
        .single()

      if (conversa) {
        const agora = new Date().toISOString()
        await Promise.all([
          db.from('mensagens_email').insert({
            conversa_id: conversa.id,
            direcao: 'entrada',
            de: emailFrom,
            corpo_html: corpoHtml,
            corpo_texto: corpoTexto,
            lida: false,
          }),
          db.from('conversas_email').update({
            status: 'respondido',
            total_mensagens: (conversa.total_mensagens || 1) + 1,
            nao_lidas: (conversa.nao_lidas || 0) + 1,
            ultima_mensagem_em: agora,
          }).eq('id', conversa.id),
        ])
      } else {
        // Lead escreveu sem campanha prévia: cria conversa nova
        const { data: lead } = await db
          .from('leads').select('id, nome').eq('email', emailFrom).single()
        const { data: novaConversa } = await db
          .from('conversas_email')
          .insert({
            lead_id: lead?.id || null,
            email_lead: emailFrom,
            nome_lead: lead?.nome || emailFrom,
            assunto,
            status: 'respondido',
            nao_lidas: 1,
          })
          .select('id').single()
        if (novaConversa) {
          await db.from('mensagens_email').insert({
            conversa_id: novaConversa.id,
            direcao: 'entrada',
            de: emailFrom,
            corpo_html: corpoHtml,
            corpo_texto: corpoTexto,
            lida: false,
          })
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Eventos de envio (delivered, opened, clicked…) ────────────
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

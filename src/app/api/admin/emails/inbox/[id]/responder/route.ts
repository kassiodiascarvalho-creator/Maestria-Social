import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type P = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params
  const { corpo_texto } = await req.json()
  if (!corpo_texto?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: conversa } = await db
    .from('conversas_email')
    .select('*, email_campanhas(remetente_nome, remetente_email)')
    .eq('id', id).single()

  if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

  const remetenteNome = conversa.email_campanhas?.remetente_nome || 'Maestria Social'
  const remetenteEmail = conversa.email_campanhas?.remetente_email || 'time@maestriasocial.com'

  const corpo_html = `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#333;">${corpo_texto.replace(/\n/g, '<br>')}</p>`

  const { Resend } = await import('resend')
  const { getConfig } = await import('@/lib/config')
  const apiKey = await getConfig('RESEND_API_KEY')
  const resend = new Resend(apiKey || process.env.RESEND_API_KEY)

  const { data: sent, error: sendError } = await resend.emails.send({
    from: `${remetenteNome} <${remetenteEmail}>`,
    to: [conversa.email_lead],
    subject: `Re: ${conversa.assunto}`,
    html: corpo_html,
    text: corpo_texto,
  })

  if (sendError || !sent?.id) {
    return NextResponse.json({ error: sendError?.message || 'Falha ao enviar' }, { status: 500 })
  }

  const agora = new Date().toISOString()

  await Promise.all([
    db.from('mensagens_email').insert({
      conversa_id: id,
      direcao: 'saida',
      de: `${remetenteNome} <${remetenteEmail}>`,
      corpo_html,
      corpo_texto,
      lida: true,
      resend_message_id: sent.id,
    }),
    db.from('conversas_email').update({
      status: 'aguardando',
      total_mensagens: conversa.total_mensagens + 1,
      ultima_mensagem_em: agora,
    }).eq('id', id),
  ])

  return NextResponse.json({ ok: true })
}

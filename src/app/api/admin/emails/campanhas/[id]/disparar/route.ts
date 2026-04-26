import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/enviar'

export const maxDuration = 300 // 5 min — Vercel Pro

const db = () => createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
type P = { params: Promise<{ id: string }> }

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL}`
  : 'http://localhost:3000'

function injetarTracking(html: string, logId: string): string {
  // Pixel de abertura
  const pixel = `<img src="${BASE_URL}/api/track/open/${logId}" width="1" height="1" style="display:none" alt="" />`

  // Substituir links <a href="..."> por links rastreados
  const htmlComLinks = html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_, url) => {
      if (url.includes('/api/track/')) return `href="${url}"`
      const tracked = `${BASE_URL}/api/track/click/${logId}?url=${encodeURIComponent(url)}`
      return `href="${tracked}"`
    }
  )

  // Inserir pixel antes do </body> ou no final
  return htmlComLinks.includes('</body>')
    ? htmlComLinks.replace('</body>', `${pixel}</body>`)
    : htmlComLinks + pixel
}

function substituirVariaveis(html: string, vars: Record<string, string>): string {
  return html.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params
  const { preview_email } = await req.json().catch(() => ({}))

  // Busca campanha
  const { data: campanha } = await db()
    .from('email_campanhas')
    .select('*')
    .eq('id', id).single()

  if (!campanha) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  if (campanha.status === 'enviado') return NextResponse.json({ error: 'Campanha já foi enviada' }, { status: 409 })

  // Modo preview: envia só para um email de teste
  if (preview_email) {
    const html = campanha.html || '<p>Sem conteúdo</p>'
    const testLogId = 'preview-' + Date.now()
    await enviarEmail({
      para: preview_email,
      assunto: `[PREVIEW] ${campanha.assunto_a}`,
      html: injetarTracking(html, testLogId),
      texto: campanha.texto || '',
    })
    return NextResponse.json({ ok: true, preview: true })
  }

  if (!campanha.lista_id) return NextResponse.json({ error: 'Campanha sem lista definida' }, { status: 400 })

  // Busca template se necessário
  let htmlBase = campanha.html || ''
  if (!htmlBase && campanha.template_id) {
    const { data: tpl } = await db().from('email_templates').select('html,corpo').eq('id', campanha.template_id).single()
    htmlBase = tpl?.html || tpl?.corpo || ''
  }
  if (!htmlBase) return NextResponse.json({ error: 'Campanha sem conteúdo HTML' }, { status: 400 })

  // Busca contatos ativos da lista
  const { data: contatos } = await db()
    .from('email_lista_contatos')
    .select('id, email, nome, lead_id')
    .eq('lista_id', campanha.lista_id)
    .eq('status', 'ativo')

  if (!contatos?.length) return NextResponse.json({ error: 'Lista sem contatos ativos' }, { status: 400 })

  // Marca campanha como enviando
  await db().from('email_campanhas').update({ status: 'enviando', iniciado_em: new Date().toISOString() }).eq('id', id)

  let enviados = 0, falhas = 0

  for (const contato of contatos) {
    try {
      // A/B: decide variante
      const variante = campanha.ab_ativo && Math.random() * 100 < (campanha.ab_percentual ?? 50) ? 'b' : 'a'
      const assunto = variante === 'b' && campanha.assunto_b ? campanha.assunto_b : campanha.assunto_a

      // Cria log antes de enviar para ter o ID
      const { data: log } = await db()
        .from('email_logs')
        .insert({
          campanha_id: id,
          contato_id: contato.id,
          lead_id: contato.lead_id || null,
          email: contato.email,
          nome: contato.nome,
          variante,
          status: 'enviando',
        })
        .select('id').single()

      if (!log) { falhas++; continue }

      // Personaliza HTML com variáveis e tracking
      const vars: Record<string, string> = {
        nome: contato.nome || 'Olá',
        email: contato.email,
      }
      const htmlFinal = injetarTracking(substituirVariaveis(htmlBase, vars), log.id)

      // Envia via Resend
      const { Resend } = await import('resend')
      const { getConfig } = await import('@/lib/config')
      const apiKey = await getConfig('RESEND_API_KEY')
      const resend = new Resend(apiKey || process.env.RESEND_API_KEY)

      const { data: sent, error: sendError } = await resend.emails.send({
        from: `${campanha.remetente_nome} <${campanha.remetente_email}>`,
        to: [contato.email],
        subject: assunto,
        html: htmlFinal,
        text: campanha.texto || '',
        headers: {
          'List-Unsubscribe': `<${BASE_URL}/api/track/unsub/${log.id}>`,
        },
      })

      if (sendError || !sent?.id) {
        await db().from('email_logs').update({ status: 'erro', erro_msg: String(sendError?.message || 'falha') }).eq('id', log.id)
        falhas++
      } else {
        await db().from('email_logs').update({ status: 'enviando', resend_id: sent.id }).eq('id', log.id)
        enviados++
      }

      // Rate limit: 2 envios/s para não saturar Resend
      if (enviados % 2 === 0) await new Promise(r => setTimeout(r, 1000))

    } catch (err) {
      falhas++
      console.error('[disparar]', contato.email, err)
    }
  }

  // Marca campanha como enviada
  await db().from('email_campanhas').update({
    status: 'enviado',
    total_enviados: enviados,
    concluido_em: new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json({ ok: true, enviados, falhas, total: contatos.length })
}

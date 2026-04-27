import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/enviar'

export const maxDuration = 300 // 5 min — Vercel Pro

const db = () => createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
type P = { params: Promise<{ id: string }> }

function resolverBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || ''
  if (!raw) return 'http://localhost:3000'
  // Remove protocolo existente para evitar https://https://...
  const semProtocolo = raw.replace(/^https?:\/\//, '')
  return `https://${semProtocolo}`
}
const BASE_URL = resolverBaseUrl()

function injetarTracking(html: string, logId: string): string {
  // Pixel de abertura — sem display:none pois alguns clientes bloqueiam com mais agressividade
  const pixel = `<img src="${BASE_URL}/api/track/open/${logId}" width="1" height="1" border="0" alt="" />`

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

function htmlParaTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const LOGO_URL = 'https://i.imgur.com/mJZwwpe.png'

function embrulharHtml(conteudo: string, unsubUrl: string, remetenteNome: string): string {
  // Se o conteúdo já tem estrutura HTML completa, apenas injeta o rodapé de marca
  if (/<html/i.test(conteudo)) {
    const rodapeSimples = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2a2a1e;margin-top:32px;">
  <tr><td style="padding:24px 0;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#7a7a6a;line-height:1.7;">
    <p style="margin:0 0 6px;">Você recebe este e-mail porque se cadastrou em um formulário da <strong style="color:#c2904d;">${remetenteNome}</strong>.</p>
    <p style="margin:0;"><a href="${unsubUrl}" style="color:#c2904d;text-decoration:none;border-bottom:1px solid #c2904d;">Cancelar inscrição</a></p>
  </td></tr>
</table>`
    return conteudo.includes('</body>')
      ? conteudo.replace('</body>', `${rodapeSimples}</body>`)
      : conteudo + rodapeSimples
  }

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${remetenteNome}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0c0d08;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0c0d08;">
    <tr>
      <td align="center" style="padding:40px 16px 48px;">

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background-color:#0f1009;border-radius:2px;">

          <!-- ── HEADER: logo + título ── -->
          <tr>
            <td align="center" style="padding:36px 48px 28px;">
              <img src="${LOGO_URL}" alt="Maestria Social" width="56" height="56"
                style="display:block;margin:0 auto 16px;border:0;outline:none;text-decoration:none;" />
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:4px;color:#c2904d;text-transform:uppercase;margin-bottom:4px;">MAESTRIA SOCIAL</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5a5a4a;letter-spacing:1px;">Inteligência Social aplicada</div>
            </td>
          </tr>

          <!-- Separador dourado -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background-color:#2a2518;border-top:1px solid #c2904d11;"></div>
            </td>
          </tr>

          <!-- ── CONTEÚDO ── -->
          <tr>
            <td style="padding:36px 48px 32px;color:#d8cfc0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.8;">
              ${conteudo}
            </td>
          </tr>

          <!-- Separador inferior -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background-color:#1e1e14;"></div>
            </td>
          </tr>

          <!-- ── FOOTER: logo pequena + unsubscribe ── -->
          <tr>
            <td align="center" style="padding:24px 48px 32px;">
              <img src="${LOGO_URL}" alt="Maestria Social" width="28" height="28"
                style="display:block;margin:0 auto 10px;opacity:0.5;border:0;outline:none;text-decoration:none;" />
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#3a3a2e;margin-bottom:8px;">
                © Maestria Social · <a href="https://maestriasocial.com" style="color:#3a3a2e;text-decoration:none;">maestriasocial.com</a>
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#4a4a38;">
                Você recebe este e-mail porque se cadastrou em um formulário da Maestria Social.<br>
                <a href="${unsubUrl}" style="color:#7a6a4a;text-decoration:underline;">Cancelar inscrição</a>
              </div>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
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
      const unsubUrl = `${BASE_URL}/api/track/unsub/${log.id}`
      const htmlPersonalizado = substituirVariaveis(htmlBase, vars)
      const htmlEmbrulhado = embrulharHtml(htmlPersonalizado, unsubUrl, campanha.remetente_nome)
      const htmlFinal = injetarTracking(htmlEmbrulhado, log.id)
      const textoFinal = campanha.texto?.trim() || htmlParaTexto(htmlPersonalizado)

      // Envia via Resend
      const { Resend } = await import('resend')
      const { getConfig } = await import('@/lib/config')
      const apiKey = await getConfig('RESEND_API_KEY')
      const resend = new Resend(apiKey || process.env.RESEND_API_KEY)

      const { data: sent, error: sendError } = await resend.emails.send({
        from: `${campanha.remetente_nome || 'Maestria Social'} <${campanha.remetente_email || 'time@maestriasocial.com'}>`,
        to: [contato.email],
        subject: assunto,
        html: htmlFinal,
        text: textoFinal,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>, <mailto:time@maestriasocial.com?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'Precedence': 'bulk',
          'X-Entity-Ref-ID': `maestria-${log.id}`,
        },
      })

      if (sendError || !sent?.id) {
        await db().from('email_logs').update({ status: 'erro', erro_msg: String(sendError?.message || 'falha') }).eq('id', log.id)
        falhas++
      } else {
        await db().from('email_logs').update({ status: 'enviando', resend_id: sent.id }).eq('id', log.id)
        enviados++

        // Cria conversa no Inbox (não bloqueia o disparo se falhar)
        try {
          const { data: novaConversa } = await db()
            .from('conversas_email')
            .insert({
              lead_id: contato.lead_id || null,
              campanha_id: id,
              email_lead: contato.email,
              nome_lead: contato.nome || null,
              assunto,
              status: 'aguardando',
              ultima_mensagem_em: new Date().toISOString(),
            })
            .select('id').single()
          if (novaConversa?.id) {
            await db().from('mensagens_email').insert({
              conversa_id: novaConversa.id,
              direcao: 'saida',
              de: `${campanha.remetente_nome || 'Maestria Social'} <${campanha.remetente_email || 'time@maestriasocial.com'}>`,
              corpo_html: htmlFinal,
              corpo_texto: textoFinal,
              lida: true,
              resend_message_id: sent.id,
            })
          }
        } catch (e) {
          console.error('[inbox-conversa]', contato.email, e)
        }
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

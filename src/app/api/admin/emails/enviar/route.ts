import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/enviar'
import type { Lead, NivelQS, StatusLead } from '@/types/database'

const SITE_URL = 'https://maestriasocial.com'

function resolverVariaveis(texto: string, lead: Lead): string {
  return texto
    .replace(/{nome}/g, lead.nome)
    .replace(/{qs_total}/g, String(lead.qs_total ?? 0))
    .replace(/{qs_percentual}/g, String(lead.qs_percentual ?? 0))
    .replace(/{nivel_qs}/g, lead.nivel_qs ?? '')
    .replace(/{pilar_fraco}/g, lead.pilar_fraco ?? '')
    .replace(/{link_resultado}/g, `${SITE_URL}/resultado/${lead.id}`)
}

function wrapHtml(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#0e0f09;font-family:Arial,sans-serif;color:#fff9e6;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:11px;color:#c2904d;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:18px;">◆ Maestria Social</div>
    <h1 style="font-size:26px;line-height:1.2;color:#fff9e6;margin:0 0 18px;">${titulo}</h1>
    <div style="font-size:15px;line-height:1.7;color:#cdbfa8;">${corpo}</div>
    <div style="margin-top:28px;"><a href="${SITE_URL}/obrigado" style="display:inline-block;background:#c2904d;color:#0e0f09;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;">Conversar no WhatsApp →</a></div>
    <hr style="border:none;border-top:1px solid #2a1f18;margin:32px 0 18px;">
    <p style="font-size:12px;color:#7a6e5e;">Maestria Social — Inteligência Social aplicada</p>
  </div>
</body></html>`
}

// POST — envio manual de um template para um lead específico ou filtrado
// body: { template_id, lead_id?, filtro_pilar?, filtro_nivel?, filtro_status? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { template_id, lead_id, filtro_pilar, filtro_nivel, filtro_status } =
    body as {
      template_id: string
      lead_id?: string
      filtro_pilar?: string
      filtro_nivel?: string
      filtro_status?: string
    }

  if (!template_id) return NextResponse.json({ error: 'template_id obrigatório' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: tpl, error: tplErr } = await supabase
    .from('email_templates')
    .select('assunto, corpo_html')
    .eq('id', template_id)
    .single()

  if (tplErr || !tpl) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

  let leads: Lead[]
  if (lead_id) {
    const { data } = await supabase.from('leads').select('*').eq('id', lead_id).single()
    if (!data) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    leads = [data as Lead]
  } else {
    let query = supabase
      .from('leads')
      .select('*')
      .not('qs_total', 'is', null)

    if (filtro_pilar) query = query.eq('pilar_fraco', filtro_pilar)
    if (filtro_nivel) query = query.eq('nivel_qs', filtro_nivel as NivelQS)
    if (filtro_status) query = query.eq('status_lead', filtro_status as StatusLead)

    const { data } = await query
    leads = (data ?? []) as Lead[]
  }

  let ok = 0
  let fail = 0
  for (const lead of leads) {
    try {
      const assunto = resolverVariaveis(tpl.assunto, lead)
      const corpo = resolverVariaveis(tpl.corpo_html, lead)
      await enviarEmail({ para: lead.email, assunto, html: wrapHtml(assunto, corpo), texto: assunto })
      ok++
    } catch {
      fail++
    }
  }

  return NextResponse.json({ enviados: ok, falhas: fail, total: leads.length })
}

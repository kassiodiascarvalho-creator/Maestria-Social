import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'
import { enviarMensagemInicialWhatsApp } from '@/lib/meta'

const META_API_URL = 'https://graph.facebook.com/v21.0'

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

async function handler(lead_id: string): Promise<NextResponse> {
  try {
    const supabase = createAdminClient()
    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single()
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    const phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
    const accessToken = await getConfig('META_ACCESS_TOKEN')
    const templateName = await getConfig('META_TEMPLATE_NAME')
    const templateLanguage = (await getConfig('META_TEMPLATE_LANGUAGE')) || 'pt_BR'
    const whatsappMode = await getConfig('WHATSAPP_MODE')

    const diagnostico = {
      lead_whatsapp: lead.whatsapp,
      numero_normalizado: normalizarTelefone(lead.whatsapp),
      META_PHONE_NUMBER_ID: phoneNumberId ? '✅ configurado' : 'NÃO CONFIGURADO',
      META_ACCESS_TOKEN: accessToken ? '✅ configurado' : 'NÃO CONFIGURADO',
      META_TEMPLATE_NAME: templateName || 'NÃO CONFIGURADO',
      META_TEMPLATE_LANGUAGE: templateLanguage,
      WHATSAPP_MODE: whatsappMode || 'não definido (padrão: meta)',
    }

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ erro: 'Credenciais Meta não configuradas', diagnostico })
    }

    if (!templateName) {
      return NextResponse.json({ erro: 'META_TEMPLATE_NAME não configurado', diagnostico })
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: normalizarTelefone(lead.whatsapp),
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: lead.nome },
              { type: 'text', text: String(lead.qs_total ?? 0) },
              { type: 'text', text: lead.pilar_fraco ?? 'Comunicação' },
            ],
          },
        ],
      },
    }

    const res = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    const resposta = await res.json()

    if (!res.ok) {
      return NextResponse.json({ erro: 'Meta API retornou erro', status: res.status, resposta, diagnostico, payload })
    }

    return NextResponse.json({ ok: true, mensagem: 'Enviado com sucesso!', resposta, diagnostico })
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}

async function handlerViaService(lead_id: string): Promise<NextResponse> {
  try {
    const supabase = createAdminClient()
    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single()
    if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

    try {
      await enviarMensagemInicialWhatsApp(lead.whatsapp, 'teste fallback', {
        nome: lead.nome,
        qs_total: lead.qs_total ?? 0,
        pilar_fraco: lead.pilar_fraco ?? 'Comunicação',
      })
      return NextResponse.json({ ok: true, via: 'enviarMensagemInicialWhatsApp' })
    } catch (err) {
      return NextResponse.json({ ok: false, via: 'enviarMensagemInicialWhatsApp', erro: String(err) })
    }
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const lead_id = req.nextUrl.searchParams.get('lead_id')
  if (!lead_id) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })
  const via = req.nextUrl.searchParams.get('via')
  if (via === 'service') return handlerViaService(lead_id)
  return handler(lead_id)
}

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json() as { lead_id: string }
  if (!lead_id) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })
  return handler(lead_id)
}

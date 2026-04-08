import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

export async function POST(req: NextRequest) {
  try {
    const { lead_id } = await req.json() as { lead_id: string }
    if (!lead_id) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })

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
      META_PHONE_NUMBER_ID: phoneNumberId ? `${phoneNumberId.substring(0, 6)}...` : 'NÃO CONFIGURADO',
      META_ACCESS_TOKEN: accessToken ? `${accessToken.substring(0, 10)}...` : 'NÃO CONFIGURADO',
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

    // Tenta enviar o template
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

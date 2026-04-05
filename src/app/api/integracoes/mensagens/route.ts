import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validarApiKey } from '@/lib/integracoes-auth'
import { responderAgenteParaLead } from '@/lib/agente/service'

function normalizarTelefone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

export async function POST(req: NextRequest) {
  const autorizado = await validarApiKey(req)
  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { lead_id, whatsapp, mensagem, responder_whatsapp } = body as {
    lead_id?: string
    whatsapp?: string
    mensagem?: string
    responder_whatsapp?: boolean
  }

  if (!mensagem?.trim()) {
    return NextResponse.json({ error: 'mensagem é obrigatória' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let leadId = lead_id

  if (!leadId && whatsapp) {
    const numero = normalizarTelefone(whatsapp)
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('whatsapp', numero)
      .maybeSingle()
    leadId = data?.id
  }

  if (!leadId) {
    return NextResponse.json({ error: 'lead_id ou whatsapp válido é obrigatório' }, { status: 400 })
  }

  const resultado = await responderAgenteParaLead(leadId, mensagem.trim(), responder_whatsapp === true)
  return NextResponse.json(resultado)
}

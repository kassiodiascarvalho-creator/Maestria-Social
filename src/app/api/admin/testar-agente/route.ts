import { NextRequest, NextResponse } from 'next/server'
import { responderAgenteParaLead } from '@/lib/agente/service'
import { createAdminClient } from '@/lib/supabase/admin'

const TOKEN = 'fix-maestria-2024'

// Simula uma mensagem chegando de um lead pelo whatsapp
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const whatsapp = searchParams.get('whatsapp') || '33984522635'
  const mensagem = searchParams.get('msg') || 'Olá, quero saber mais'

  // Busca lead pelo whatsapp
  const supabase = createAdminClient()
  const digits = whatsapp.replace(/\D/g, '')
  const full = digits.startsWith('55') ? digits : `55${digits}`
  const short = full.slice(2)

  let lead = null
  for (const t of [full, short, whatsapp]) {
    const { data } = await supabase.from('leads').select('id, nome, whatsapp').eq('whatsapp', t).maybeSingle()
    if (data) { lead = data; break }
  }

  if (!lead) {
    const { data } = await supabase
      .from('leads').select('id, nome, whatsapp')
      .or(`whatsapp.ilike.%${short}%,whatsapp.ilike.%${full}%`)
      .limit(1).maybeSingle()
    lead = data
  }

  if (!lead) {
    return NextResponse.json({ error: `Lead não encontrado para whatsapp: ${whatsapp}. Leads existentes:`, hint: 'Verifique se o número está cadastrado na tabela leads' }, { status: 404 })
  }

  try {
    const resultado = await responderAgenteParaLead(lead.id, mensagem, true)
    return NextResponse.json({
      ok: true,
      lead: { id: lead.id, nome: lead.nome, whatsapp: lead.whatsapp },
      mensagemEnviada: mensagem,
      respostaAgente: resultado.resposta,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { responderAgenteParaLead } from '@/lib/agente/service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id, mensagem } = body as { lead_id?: string; mensagem?: string }

    if (!lead_id || !mensagem) {
      return NextResponse.json({ error: 'lead_id e mensagem são obrigatórios' }, { status: 400 })
    }

    const resultado = await responderAgenteParaLead(lead_id, mensagem, true)
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[agente/responder]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

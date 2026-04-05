import { NextRequest, NextResponse } from 'next/server'
import { iniciarAgenteParaLead } from '@/lib/agente/service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id } = body as { lead_id?: string }

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 })
    }

    const resultado = await iniciarAgenteParaLead(lead_id)
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[agente/iniciar]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

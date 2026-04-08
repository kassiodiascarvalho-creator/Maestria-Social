import { NextRequest, NextResponse } from 'next/server'
import { iniciarAgenteParaLead } from '@/lib/agente/service'

export async function POST(req: NextRequest) {
  try {
    const { lead_id } = await req.json()
    if (!lead_id) return NextResponse.json({ error: 'lead_id obrigatório' }, { status: 400 })

    const resultado = await iniciarAgenteParaLead(lead_id, true)

    if (resultado.erroWhatsApp) {
      return NextResponse.json({
        ok: false,
        mensagemSalva: true,
        erro: resultado.erroWhatsApp,
      })
    }

    return NextResponse.json({ ok: true, mensagemSalva: true })
  } catch (err) {
    console.error('[reenviar-mensagem-inicial]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

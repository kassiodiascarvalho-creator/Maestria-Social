import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: instancia, error } = await (supabase as any)
    .from('whatsapp_instancias')
    .select('tipo, baileys_instance_id, meta_phone_number_id, meta_access_token, ativo')
    .eq('id', id)
    .single()

  if (error || !instancia) {
    return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
  }

  if (instancia.tipo === 'meta') {
    // Valida o token Meta consultando o Graph API
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${instancia.meta_phone_number_id}?access_token=${instancia.meta_access_token}`
      )
      const json = await res.json()
      if (json.error) {
        return NextResponse.json({ status: 'erro', detalhe: json.error.message })
      }
      return NextResponse.json({
        status: 'conectado',
        detalhe: json.display_phone_number ?? instancia.meta_phone_number_id,
      })
    } catch {
      return NextResponse.json({ status: 'erro', detalhe: 'Falha ao contatar Meta API' })
    }
  }

  // Baileys — proxy para o servidor local
  const baileysUrl = process.env.BAILEYS_API_URL || 'http://localhost:3001'
  const instanceId = instancia.baileys_instance_id

  try {
    const [statusRes, qrRes] = await Promise.all([
      fetch(`${baileysUrl}/instancia/${instanceId}/status`).then(r => r.json()).catch(() => null),
      fetch(`${baileysUrl}/instancia/${instanceId}/qr`).then(r => r.json()).catch(() => null),
    ])

    const connected = statusRes?.status === 'open'
    return NextResponse.json({
      status: connected ? 'conectado' : 'aguardando_qr',
      detalhe: statusRes?.phone ?? null,
      qr: connected ? null : (qrRes?.qr ?? null),
    })
  } catch {
    return NextResponse.json({ status: 'offline', detalhe: 'Servidor Baileys inacessível' })
  }
}

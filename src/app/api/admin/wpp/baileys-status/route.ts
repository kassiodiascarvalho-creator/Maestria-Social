import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

type InstanciaInfo = {
  id: string
  label: string
  status: string
  phone: string | null
  connected: boolean
  temQr: boolean
  qr?: string | null
}

// GET — retorna status de todas as instâncias Baileys (com QR quando disponível)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const apiUrl = await getConfig('BAILEYS_API_URL')
  if (!apiUrl) {
    return NextResponse.json({ error: 'BAILEYS_API_URL não configurada' }, { status: 400 })
  }

  const base = apiUrl.replace(/\/$/, '')

  try {
    // Busca lista de instâncias
    const listRes = await fetch(`${base}/instancias`, { signal: AbortSignal.timeout(5000) })
    if (!listRes.ok) {
      return NextResponse.json({ error: 'Servidor Baileys não respondeu' }, { status: 502 })
    }

    const instancias: InstanciaInfo[] = await listRes.json()

    // Para instâncias com QR disponível, busca o QR em paralelo
    await Promise.all(
      instancias
        .filter(inst => inst.temQr)
        .map(async (inst) => {
          try {
            const qrRes = await fetch(`${base}/instancia/${inst.id}/qr`, {
              signal: AbortSignal.timeout(5000),
            })
            if (qrRes.ok) {
              const data = await qrRes.json()
              inst.qr = data.qr ?? null
            }
          } catch {
            inst.qr = null
          }
        })
    )

    return NextResponse.json(instancias)
  } catch {
    return NextResponse.json({ error: 'Servidor Baileys offline ou inacessível' }, { status: 502 })
  }
}

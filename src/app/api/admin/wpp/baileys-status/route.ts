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

// POST — adiciona nova instância
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const apiUrl = await getConfig('BAILEYS_API_URL')
  if (!apiUrl) return NextResponse.json({ error: 'BAILEYS_API_URL não configurada' }, { status: 400 })

  const { label, phone } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: '"label" é obrigatório' }, { status: 400 })

  const base = apiUrl.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/instancias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim(), phone: phone?.trim() || undefined }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Erro no servidor Baileys' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Servidor Baileys offline ou inacessível' }, { status: 502 })
  }
}

// DELETE — remove instância
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const apiUrl = await getConfig('BAILEYS_API_URL')
  if (!apiUrl) return NextResponse.json({ error: 'BAILEYS_API_URL não configurada' }, { status: 400 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })

  const base = apiUrl.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/instancia/${id}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Erro no servidor Baileys' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Servidor Baileys offline ou inacessível' }, { status: 502 })
  }
}

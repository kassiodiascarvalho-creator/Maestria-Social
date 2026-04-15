import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConfig, setConfig } from '@/lib/config'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// POST — sincroniza instâncias Baileys com os canais selecionados para o agente
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const canaisRaw = await getConfig('AGENT_CANAIS')
  let canais: Array<{ provider: string; id: string }> = []
  try {
    if (canaisRaw) canais = JSON.parse(canaisRaw)
  } catch { /* ignora */ }

  const baileysInstances = canais
    .filter(c => c.provider === 'baileys')
    .map(c => c.id)

  const apiUrl = await getConfig('BAILEYS_API_URL')
  if (!apiUrl) {
    // Sem Baileys configurado — ok se não tem instâncias selecionadas
    if (baileysInstances.length === 0) return NextResponse.json({ ok: true })
    return NextResponse.json({ error: 'BAILEYS_API_URL não configurada' }, { status: 400 })
  }

  // Garante que existe um secret para autenticar o webhook
  let secret = await getConfig('AGENT_BAILEYS_SECRET')
  if (!secret) {
    secret = randomBytes(24).toString('hex')
    await setConfig('AGENT_BAILEYS_SECRET', secret)
  }

  // URL do webhook que o servidor Baileys chamará ao receber mensagens
  const webhookUrl = `${req.nextUrl.origin}/api/webhook/baileys`

  const base = apiUrl.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/config/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: baileysInstances.length > 0 ? webhookUrl : null,
        webhookSecret: secret,
        instances: baileysInstances,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err.error || 'Erro no servidor Baileys' }, { status: res.status })
    }
  } catch {
    return NextResponse.json({ error: 'Servidor Baileys offline ou inacessível' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, webhookUrl, instances: baileysInstances })
}

import { createHmac } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EventoWebhook } from '@/types/database'

function assinarPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export async function dispararWebhookSaida(evento: EventoWebhook, data: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data: hooks, error } = await supabase
      .from('webhook_configs')
      .select('url, secret')
      .eq('evento', evento)
      .eq('ativo', true)

    if (error || !hooks || hooks.length === 0) return

    const payload = JSON.stringify({
      evento,
      timestamp: new Date().toISOString(),
      data,
    })

    await Promise.allSettled(
      hooks.map(async (hook) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        if (hook.secret) {
          headers['x-maestria-signature'] = assinarPayload(payload, hook.secret)
        }

        await fetch(hook.url, {
          method: 'POST',
          headers,
          body: payload,
        })
      })
    )
  } catch (err) {
    console.error('[webhooks] erro ao disparar webhook:', err)
  }
}

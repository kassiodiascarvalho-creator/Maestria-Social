import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

function extrairApiKey(req: NextRequest): string | null {
  const headerKey = req.headers.get('x-api-key')
  if (headerKey) return headerKey.trim()

  const auth = req.headers.get('authorization')
  if (!auth) return null
  const [tipo, token] = auth.split(' ')
  if (tipo?.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

export async function validarApiKey(req: NextRequest): Promise<boolean> {
  const apiKey = extrairApiKey(req)
  if (!apiKey) return false

  const apiKeyGlobal = await getConfig('INTEGRACOES_API_KEY')
  if (apiKeyGlobal && apiKey === apiKeyGlobal) return true

  const chaveHash = hashApiKey(apiKey)
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('api_keys')
    .select('id')
    .eq('chave_hash', chaveHash)
    .eq('ativa', true)
    .maybeSingle()

  return !!data
}

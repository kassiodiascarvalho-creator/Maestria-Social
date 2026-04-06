import { createAdminClient } from './supabase/admin'

// Busca uma config: primeiro tenta process.env, depois a tabela configuracoes
export async function getConfig(chave: string): Promise<string | null> {
  const fromEnv = process.env[chave]
  if (fromEnv) return fromEnv.trim()

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .single()
    return data?.valor?.trim() ?? null
  } catch {
    return null
  }
}

export async function setConfig(chave: string, valor: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('configuracoes')
    .upsert({ chave, valor }, { onConflict: 'chave' })
}

import { randomBytes, createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}

function gerarApiKey(): { plain: string; prefixo: string } {
  const raw = randomBytes(24).toString('hex')
  const plain = `ms_live_${raw}`
  return { plain, prefixo: plain.slice(0, 12) }
}

async function ensureAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await ensureAuth()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, nome, chave_prefixo, ativa, criado_em')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ api_keys: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await ensureAuth()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const nome = (body.nome as string | undefined)?.trim()

  if (!nome) {
    return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })
  }

  const { plain, prefixo } = gerarApiKey()
  const chaveHash = hashApiKey(plain)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      nome,
      chave_hash: chaveHash,
      chave_prefixo: prefixo,
      ativa: true,
    })
    .select('id, nome, chave_prefixo, ativa, criado_em')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ api_key: data, plain_key: plain }, { status: 201 })
}

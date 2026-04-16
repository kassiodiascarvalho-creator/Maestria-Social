import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig, setConfig } from '@/lib/config'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// Helper: acessa tabela 'agentes' sem exigir tipos gerados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ag = (admin: ReturnType<typeof createAdminClient>) => (admin as any).from('agentes')

// GET — retorna um agente
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await ag(admin).select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

// PUT — atualiza agente (garante exclusividade de canais entre agentes)
export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { nome, descricao, prompt, temperatura, modelo, ativo, canais, link_agendamento } = body

  const admin = createAdminClient()

  // Garante exclusividade: remove os canais selecionados de todos os outros agentes
  if (Array.isArray(canais) && canais.length > 0) {
    const { data: outros } = await ag(admin).select('id, canais').neq('id', id)

    for (const outro of (outros || []) as Array<{ id: string; canais: Array<{ provider: string; id: string }> }>) {
      const outrosCanais = (outro.canais || []) as Array<{ provider: string; id: string }>
      const novosCanais = outrosCanais.filter(c =>
        !canais.some((nc: { provider: string; id: string }) =>
          nc.provider === c.provider && nc.id === c.id
        )
      )
      if (novosCanais.length !== outrosCanais.length) {
        await ag(admin).update({ canais: novosCanais }).eq('id', outro.id)
      }
    }
  }

  const { data, error } = await ag(admin)
    .update({
      ...(nome !== undefined && { nome: nome.trim() }),
      ...(descricao !== undefined && { descricao: descricao.trim() }),
      ...(prompt !== undefined && { prompt }),
      ...(temperatura !== undefined && { temperatura }),
      ...(modelo !== undefined && { modelo }),
      ...(ativo !== undefined && { ativo }),
      ...(canais !== undefined && { canais }),
      ...(link_agendamento !== undefined && { link_agendamento: link_agendamento || null }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sincronizarBaileys(req)
  return NextResponse.json(data)
}

// DELETE — exclui agente
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { count } = await ag(admin).select('id', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Não é possível excluir o único agente existente' }, { status: 400 })
  }

  const { error } = await ag(admin).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sincronizarBaileys(_req)
  return NextResponse.json({ ok: true })
}

// Sincroniza todas as instâncias Baileys ativas com base em todos os agentes
async function sincronizarBaileys(req: NextRequest) {
  try {
    const apiUrl = await getConfig('BAILEYS_API_URL')
    if (!apiUrl) return

    const admin = createAdminClient()
    const { data: agentes } = await ag(admin).select('canais')

    const todasInstancias = new Set<string>()
    for (const agente of agentes || []) {
      for (const c of (agente.canais || []) as Array<{ provider: string; id: string }>) {
        if (c.provider === 'baileys') todasInstancias.add(c.id)
      }
    }

    let secret = await getConfig('AGENT_BAILEYS_SECRET')
    if (!secret) {
      secret = randomBytes(24).toString('hex')
      await setConfig('AGENT_BAILEYS_SECRET', secret)
    }

    const webhookUrl = `${req.nextUrl.origin}/api/webhook/baileys`
    const instances = Array.from(todasInstancias)

    await fetch(`${apiUrl.replace(/\/$/, '')}/config/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: instances.length > 0 ? webhookUrl : null,
        webhookSecret: secret,
        instances,
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch { /* silencioso — servidor Baileys pode estar offline */ }
}

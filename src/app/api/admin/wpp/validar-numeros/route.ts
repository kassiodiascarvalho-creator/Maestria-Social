import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/admin/wpp/validar-numeros
// body: { lista_id, instance_id? }
// Inicia job de validação no Baileys e retorna { jobId, total }
export async function POST(req: NextRequest) {
  const { lista_id, instance_id } = await req.json() as { lista_id: string; instance_id?: string }
  if (!lista_id) return NextResponse.json({ error: 'lista_id obrigatório' }, { status: 400 })

  const baileysApiUrl = await getConfig('BAILEYS_API_URL')
  if (!baileysApiUrl) {
    return NextResponse.json({ error: 'BAILEYS_API_URL não configurada. Inicie o servidor Baileys.' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  const { data: contatos, error } = await db
    .from('wpp_contatos')
    .select('id, nome, telefone')
    .eq('lista_id', lista_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!contatos?.length) return NextResponse.json({ error: 'Lista vazia' }, { status: 400 })

  const instId = instance_id || '1'
  const base   = baileysApiUrl.replace(/\/$/, '')
  const numeros = (contatos as Array<{ telefone: string }>).map(c => c.telefone)

  // Inicia job assíncrono no Baileys — retorna imediatamente com jobId
  const resp = await fetch(`${base}/instancia/${instId}/validar-numeros-job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numeros }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { error?: string }
    return NextResponse.json({ error: err.error ?? 'Erro ao iniciar validação no Baileys' }, { status: 502 })
  }

  const { jobId } = await resp.json() as { jobId: string }

  return NextResponse.json({ ok: true, jobId, total: numeros.length, lista_id })
}

// GET /api/admin/wpp/validar-numeros?job_id=xxx&lista_id=yyy
// Faz polling do job no Baileys. Quando concluído, salva no DB e retorna resultado completo.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId   = searchParams.get('job_id')
  const listaId = searchParams.get('lista_id')

  if (!jobId || !listaId) {
    return NextResponse.json({ error: 'job_id e lista_id são obrigatórios' }, { status: 400 })
  }

  const baileysApiUrl = await getConfig('BAILEYS_API_URL')
  if (!baileysApiUrl) {
    return NextResponse.json({ error: 'BAILEYS_API_URL não configurada' }, { status: 500 })
  }

  const base = baileysApiUrl.replace(/\/$/, '')
  const resp = await fetch(`${base}/job/${jobId}`, { signal: AbortSignal.timeout(15_000) })

  if (!resp.ok) {
    return NextResponse.json({ error: 'Job não encontrado ou expirado' }, { status: 404 })
  }

  const job = await resp.json() as {
    tipo: string; status: string; total: number; processados: number
    validos: string[]; invalidos: string[]; erros: { numero: string; msg: string }[]
    erroGeral?: string
  }

  // Enquanto ainda está rodando, só retorna progresso
  if (job.status === 'rodando') {
    return NextResponse.json({
      ok: true, status: 'rodando',
      total: job.total, processados: job.processados,
    })
  }

  if (job.status === 'erro') {
    return NextResponse.json({ error: job.erroGeral ?? 'Erro no job de validação' }, { status: 500 })
  }

  // Concluído — salva no banco e retorna resultado completo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  const { data: contatos } = await db
    .from('wpp_contatos')
    .select('id, nome, telefone')
    .eq('lista_id', listaId)

  if (!contatos?.length) {
    return NextResponse.json({ error: 'Contatos não encontrados' }, { status: 404 })
  }

  type Contato = { id: string; nome: string | null; telefone: string }
  const todos = contatos as Contato[]
  const validosSet   = new Set(job.validos)
  const invalidosSet = new Set(job.invalidos)
  const errosSet     = new Set((job.erros ?? []).map((e: { numero: string }) => e.numero))
  const agora = new Date().toISOString()

  const validosIds   = todos.filter(c => validosSet.has(c.telefone)).map(c => c.id)
  const invalidosIds = todos.filter(c => invalidosSet.has(c.telefone)).map(c => c.id)

  await Promise.all([
    validosIds.length
      ? db.from('wpp_contatos').update({ valido_wpp: true,  validado_em: agora }).in('id', validosIds)
      : Promise.resolve(),
    invalidosIds.length
      ? db.from('wpp_contatos').update({ valido_wpp: false, validado_em: agora }).in('id', invalidosIds)
      : Promise.resolve(),
  ])

  const mapC = (c: Contato) => ({ id: c.id, nome: c.nome, telefone: c.telefone })

  return NextResponse.json({
    ok: true,
    status: 'concluido',
    total: todos.length,
    validos:   todos.filter(c => validosSet.has(c.telefone)).map(mapC),
    invalidos: todos.filter(c => invalidosSet.has(c.telefone)).map(mapC),
    erros:     todos.filter(c => errosSet.has(c.telefone)).map(mapC),
  })
}

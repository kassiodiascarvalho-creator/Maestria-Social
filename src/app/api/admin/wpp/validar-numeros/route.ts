import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Listas grandes podem ter 500+ contatos — máximo permitido no plano Hobby
export const maxDuration = 300

// POST /api/admin/wpp/validar-numeros
// body: { lista_id: string; instance_id?: string }
// Verifica via Baileys quais números da lista existem no WhatsApp,
// atualiza wpp_contatos com valido_wpp + validado_em e retorna os dois grupos.
export async function POST(req: NextRequest) {
  const { lista_id, instance_id } = await req.json() as { lista_id: string; instance_id?: string }
  console.log(`[validar-numeros] iniciando lista=${lista_id} instancia=${instance_id ?? '1'}`)
  if (!lista_id) return NextResponse.json({ error: 'lista_id obrigatório' }, { status: 400 })

  const baileysApiUrl = await getConfig('BAILEYS_API_URL')
  if (!baileysApiUrl) {
    return NextResponse.json({ error: 'BAILEYS_API_URL não configurada. Inicie o servidor Baileys.' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  // Busca todos os contatos da lista
  const { data: contatos, error } = await db
    .from('wpp_contatos')
    .select('id, nome, telefone, valido_wpp, validado_em')
    .eq('lista_id', lista_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!contatos?.length) return NextResponse.json({ error: 'Lista vazia' }, { status: 400 })

  const instId = instance_id || '1'
  const base = baileysApiUrl.replace(/\/$/, '')

  // Chama o Baileys em lotes de 100 para não travar o server local
  const LOTE = 100
  const todos = contatos as Array<{ id: string; nome: string | null; telefone: string; valido_wpp: boolean | null; validado_em: string | null }>
  const numeros = todos.map(c => c.telefone)

  const validosSet   = new Set<string>()
  const invalidosSet = new Set<string>()
  const errosSet     = new Set<string>()

  for (let i = 0; i < numeros.length; i += LOTE) {
    const lote = numeros.slice(i, i + LOTE)
    try {
      const resp = await fetch(`${base}/instancia/${instId}/validar-numeros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeros: lote }),
        signal: AbortSignal.timeout(120_000), // 2 min por lote
      })
      if (!resp.ok) {
        // Se Baileys retornar erro (ex: desconectado), marca todos como erro (não invalido)
        lote.forEach(n => errosSet.add(n))
        continue
      }
      const result = await resp.json() as { validos: string[]; invalidos: string[]; erros: { numero: string }[] }
      result.validos?.forEach(n => validosSet.add(n))
      result.invalidos?.forEach(n => invalidosSet.add(n))
      result.erros?.forEach(e => errosSet.add(e.numero))
    } catch {
      lote.forEach(n => errosSet.add(n))
    }
  }

  // Atualiza banco em lote: valid = true, invalid = false, erro = null (mantém como estava)
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

  // Monta resposta com dados completos de cada contato
  const mapContato = (c: typeof todos[0]) => ({ id: c.id, nome: c.nome, telefone: c.telefone })

  console.log(`[validar-numeros] lista=${lista_id} total=${todos.length} validos=${validosSet.size} invalidos=${invalidosSet.size} erros=${errosSet.size}`)

  return NextResponse.json({
    ok: true,
    total: todos.length,
    validos:   todos.filter(c => validosSet.has(c.telefone)).map(mapContato),
    invalidos: todos.filter(c => invalidosSet.has(c.telefone)).map(mapContato),
    erros:     todos.filter(c => errosSet.has(c.telefone)).map(mapContato),
  })
}

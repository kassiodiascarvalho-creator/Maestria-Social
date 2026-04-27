import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Domínios fictícios usados por sistemas internos (Baileys, testes, etc.)
const DOMINIOS_FALSOS = new Set([
  'disparo.local', 'whatsapp.local', 'baileys.local', 'wa.local',
  'localhost', 'local', 'internal', 'invalid', 'test', 'example',
  'lan', 'home', 'corp', 'intranet',
])

function emailReal(email: string): boolean {
  if (!email || !email.includes('@')) return false
  const [local, domain] = email.toLowerCase().trim().split('@')
  if (!local || !domain) return false
  // Parte local é só números (ex: número de WhatsApp)
  if (/^\d+$/.test(local)) return false
  // Domínio sem ponto (ex: "local", "localhost")
  if (!domain.includes('.')) return false
  // TLD (última parte após o último ponto)
  const tld = domain.split('.').pop() ?? ''
  if (DOMINIOS_FALSOS.has(tld) || DOMINIOS_FALSOS.has(domain)) return false
  // TLD muito curto ou muito longo (TLDs reais têm 2-24 chars)
  if (tld.length < 2 || tld.length > 24) return false
  return true
}

async function obterOuCriarLista(db: any, nome: string, descricao: string): Promise<string> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: existente } = await db.from('email_listas').select('id').eq('nome', nome).maybeSingle()
  if (existente) return existente.id
  const { data: nova } = await db.from('email_listas').insert({ nome, descricao }).select('id').single()
  return nova.id
}

export async function POST(req: NextRequest) {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const body = await req.json().catch(() => ({}))
  const { lista_id, filtro_origem } = body

  // Busca leads com e-mail (sem filtro de status — coluna não existe na tabela)
  let query = db.from('leads').select('id, nome, email, whatsapp, origem').not('email', 'is', null).neq('email', '')
  if (filtro_origem) query = query.ilike('origem', `%${filtro_origem}%`)

  const { data: leadsRaw, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtra e-mails fictícios do Baileys e outros sistemas internos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leads = (leadsRaw ?? []).filter((l: any) => emailReal(l.email))
  const ignorados = (leadsRaw?.length ?? 0) - leads.length

  if (!leads.length) return NextResponse.json({ ok: true, importados: 0, listas_criadas: 0, ignorados, mensagem: 'Nenhum lead com e-mail real encontrado' })

  // Se uma lista específica foi passada, importa tudo para ela
  if (lista_id) {
    const contatos = leads.map((l: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      lista_id,
      lead_id: l.id,
      email: l.email.trim().toLowerCase(),
      nome: l.nome || null,
      origem: l.origem || 'leads',
      status: 'ativo',
    }))
    let importados = 0
    for (let i = 0; i < contatos.length; i += 500) {
      const { data } = await db.from('email_lista_contatos')
        .upsert(contatos.slice(i, i + 500), { onConflict: 'lista_id,email', ignoreDuplicates: false })
        .select('id')
      if (data) importados += data.length
    }
    return NextResponse.json({ ok: true, importados, listas_criadas: 0, ignorados })
  }

  // Agrupa leads por origem — cria uma lista para cada origem distinta
  const grupos: Record<string, typeof leads> = {}
  for (const l of leads) {
    const chave = (l.origem || 'Sem origem').trim()
    if (!grupos[chave]) grupos[chave] = []
    grupos[chave].push(l)
  }

  let totalImportados = 0
  let listasCriadas = 0
  const resumo: { lista: string; importados: number }[] = []

  for (const [origem, grupo] of Object.entries(grupos)) {
    const nomeLista = origem
    const listaId = await obterOuCriarLista(db, nomeLista, `Leads com origem: ${nomeLista}`)
    listasCriadas++

    const contatos = (grupo as any[]).map((l: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      lista_id: listaId,
      lead_id: l.id,
      email: l.email.trim().toLowerCase(),
      nome: l.nome || null,
      origem: nomeLista,
      status: 'ativo',
    }))

    let importados = 0
    for (let i = 0; i < contatos.length; i += 500) {
      const { data } = await db.from('email_lista_contatos')
        .upsert(contatos.slice(i, i + 500), { onConflict: 'lista_id,email', ignoreDuplicates: false })
        .select('id')
      if (data) importados += data.length
    }
    totalImportados += importados
    resumo.push({ lista: nomeLista, importados })
  }

  return NextResponse.json({ ok: true, importados: totalImportados, listas_criadas: listasCriadas, ignorados, resumo })
}

// GET: contagem de leads com e-mail
export async function GET() {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { count } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .not('email', 'is', null)
    .neq('email', '')
  return NextResponse.json({ total_com_email: count ?? 0 })
}

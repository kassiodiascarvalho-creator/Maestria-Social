import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function normalizarTelefone(raw: string): string {
  return raw.replace(/\D/g, '')
}

// GET — busca contatos de uma lista
// Query params (opcionais, só para listas de leads):
//   filtro_pilar, filtro_nivel, filtro_status, filtro_janela (dentro|fora)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const filtroPilar = url.searchParams.get('filtro_pilar')
  const filtroNivel = url.searchParams.get('filtro_nivel')
  const filtroStatus = url.searchParams.get('filtro_status')
  const filtroJanela = url.searchParams.get('filtro_janela') // 'dentro' | 'fora'
  const filtroRenda = url.searchParams.get('filtro_renda')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  // Verifica se é lista de leads (para decidir se busca dados do lead)
  const { data: listaInfo } = await db
    .from('wpp_listas')
    .select('is_leads')
    .eq('id', id)
    .single()

  const isLeads = listaInfo?.is_leads === true

  if (isLeads) {
    // Busca contatos com dados do lead via join
    let query = db
      .from('wpp_contatos')
      .select('id, nome, telefone, criado_em, ultima_msg_user, lead_id, leads:lead_id(id, pilar_fraco, nivel_qs, status_lead, renda_mensal)')
      .eq('lista_id', id)
      .order('criado_em', { ascending: true })

    const { data: contatos, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fallback: para leads sem ultima_msg_user, busca última conversa role='user'
    const leadIds = (contatos ?? [])
      .filter((c: Record<string, unknown>) => c.lead_id && !c.ultima_msg_user)
      .map((c: Record<string, unknown>) => c.lead_id as string)

    let conversaFallback: Record<string, string> = {}
    if (leadIds.length > 0) {
      const supabaseTyped = createAdminClient()
      const { data: convs } = await supabaseTyped
        .from('conversas')
        .select('lead_id, criado_em')
        .in('lead_id', leadIds)
        .eq('role', 'user')
        .order('criado_em', { ascending: false })

      if (convs) {
        for (const cv of convs) {
          if (!conversaFallback[cv.lead_id]) {
            conversaFallback[cv.lead_id] = cv.criado_em
          }
        }
      }
    }

    const agora = Date.now()
    const VINTE_QUATRO_H = 24 * 60 * 60 * 1000

    // Aplica filtros no JS (porque os filtros são em campos da tabela leads via join)
    let resultado = (contatos ?? []).map((c: Record<string, unknown>) => {
      const lead = c.leads as Record<string, unknown> | null
      let ultimaMsg = c.ultima_msg_user as string | null
      // Fallback: usa última conversa role='user' se não tem ultima_msg_user
      if (!ultimaMsg && c.lead_id) {
        ultimaMsg = conversaFallback[c.lead_id as string] ?? null
      }
      const dentroDa24h = ultimaMsg ? (agora - new Date(ultimaMsg).getTime()) < VINTE_QUATRO_H : false

      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        criado_em: c.criado_em,
        ultima_msg_user: c.ultima_msg_user,
        dentro_24h: dentroDa24h,
        lead_id: c.lead_id,
        pilar_fraco: lead?.pilar_fraco ?? null,
        nivel_qs: lead?.nivel_qs ?? null,
        status_lead: lead?.status_lead ?? null,
        renda_mensal: lead?.renda_mensal ?? null,
      }
    })

    // Filtros
    if (filtroPilar) {
      resultado = resultado.filter((c: Record<string, unknown>) => c.pilar_fraco === filtroPilar)
    }
    if (filtroNivel) {
      resultado = resultado.filter((c: Record<string, unknown>) => c.nivel_qs === filtroNivel)
    }
    if (filtroStatus) {
      resultado = resultado.filter((c: Record<string, unknown>) => c.status_lead === filtroStatus)
    }
    if (filtroRenda) {
      resultado = resultado.filter((c: Record<string, unknown>) => c.renda_mensal === filtroRenda)
    }
    if (filtroJanela === 'dentro') {
      resultado = resultado.filter((c: Record<string, unknown>) => c.dentro_24h === true)
    } else if (filtroJanela === 'fora') {
      resultado = resultado.filter((c: Record<string, unknown>) => c.dentro_24h === false)
    }

    return NextResponse.json(resultado)
  }

  // Lista normal (sem filtros de leads)
  const { data, error } = await db
    .from('wpp_contatos')
    .select('id, nome, telefone, criado_em, ultima_msg_user')
    .eq('lista_id', id)
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const agora = Date.now()
  const VINTE_QUATRO_H = 24 * 60 * 60 * 1000
  const resultado = (data ?? []).map((c: Record<string, unknown>) => {
    const ultimaMsg = c.ultima_msg_user as string | null
    return {
      ...c,
      dentro_24h: ultimaMsg ? (agora - new Date(ultimaMsg).getTime()) < VINTE_QUATRO_H : false,
    }
  })

  return NextResponse.json(resultado)
}

// POST — adiciona contatos em lote (ou manual)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { contatos } = await req.json() as { contatos: Array<{ nome?: string; telefone: string }> }

  if (!Array.isArray(contatos) || contatos.length === 0) {
    return NextResponse.json({ error: 'contatos[] obrigatório' }, { status: 400 })
  }

  const rows = contatos
    .map(c => ({ lista_id: id, nome: c.nome?.trim() || null, telefone: normalizarTelefone(c.telefone) }))
    .filter(c => c.telefone.length >= 8)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nenhum telefone válido encontrado' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { data, error } = await db
    .from('wpp_contatos')
    .upsert(rows, { ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inseridos: data?.length ?? rows.length })
}

// DELETE — remove um contato específico
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listaId } = await params
  const { contatoId } = await req.json() as { contatoId: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { error } = await db
    .from('wpp_contatos')
    .delete()
    .eq('id', contatoId)
    .eq('lista_id', listaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

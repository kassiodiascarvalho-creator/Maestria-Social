import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LISTA_LEADS_NOME = 'Leads MS'

// POST — sincroniza todos os leads para a lista "Leads MS"
// Cria a lista se não existir, adiciona leads que ainda não estão
export async function POST() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any

    // Busca ou cria a lista "Leads MS"
    let { data: lista } = await db
      .from('wpp_listas')
      .select('id')
      .eq('is_leads', true)
      .maybeSingle()

    if (!lista) {
      const { data: nova, error: errCria } = await db
        .from('wpp_listas')
        .insert({ nome: LISTA_LEADS_NOME, is_leads: true })
        .select('id')
        .single()
      if (errCria) return NextResponse.json({ error: errCria.message }, { status: 500 })
      lista = nova
    }

    const listaId = lista.id

    // Busca todos os leads com whatsapp
    const { data: leads, error: leadsErr } = await db
      .from('leads')
      .select('id, nome, whatsapp')
      .neq('whatsapp', '')

    if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })
    if (!leads || leads.length === 0) {
      return NextResponse.json({ ok: true, sincronizados: 0 })
    }

    // Busca contatos já existentes na lista (por lead_id)
    const { data: existentes } = await db
      .from('wpp_contatos')
      .select('lead_id')
      .eq('lista_id', listaId)
      .not('lead_id', 'is', null)

    const leadsExistentes = new Set((existentes ?? []).map((c: { lead_id: string }) => c.lead_id))

    // Filtra leads que ainda não estão na lista
    const novos = leads.filter((l: { id: string }) => !leadsExistentes.has(l.id))

    if (novos.length === 0) {
      return NextResponse.json({ ok: true, sincronizados: 0, total: leads.length })
    }

    const rows = novos.map((l: { id: string; nome: string; whatsapp: string }) => ({
      lista_id: listaId,
      lead_id: l.id,
      nome: l.nome,
      telefone: l.whatsapp,
    }))

    const { error: insertErr } = await db
      .from('wpp_contatos')
      .insert(rows)

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, sincronizados: novos.length, total: leads.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

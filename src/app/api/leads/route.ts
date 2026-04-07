import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispararWebhookSaida } from '@/lib/webhooks'
import { agendarTarefa, emMinutos } from '@/lib/tarefas/agendar'

function sanitizeWhatsApp(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, whatsapp, instagram, profissao, renda_mensal } = body

    if (!nome?.trim() || !email?.trim() || !whatsapp?.trim()) {
      return NextResponse.json(
        { error: 'nome, email e whatsapp são obrigatórios' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const emailNorm = email.trim().toLowerCase()
    const wppNorm = sanitizeWhatsApp(whatsapp)

    // Busca lead existente por email OU whatsapp (evita duplicata + permite retorno)
    const { data: existing } = await supabase
      .from('leads')
      .select('id, qs_total')
      .or(`email.eq.${emailNorm},whatsapp.eq.${wppNorm}`)
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Atualiza os campos — só sobrescreve campos que o usuário preencheu
      const updates: Record<string, string | null> = { nome: nome.trim() }
      if (instagram?.trim()) updates.instagram = instagram.trim()
      if (profissao?.trim()) updates.profissao = profissao.trim()
      if (renda_mensal?.trim()) updates.renda_mensal = renda_mensal.trim()

      await supabase.from('leads').update(updates).eq('id', existing.id)

      // Agenda recuperação de quiz se ainda não finalizou
      if (!existing.qs_total) {
        try {
          await agendarTarefa({
            lead_id: existing.id,
            tipo: 'recuperacao_quiz',
            payload: {},
            agendado_para: emMinutos(15),
          })
        } catch (e) {
          console.error('[leads] erro ao agendar recuperação (existente):', e)
        }
      }

      return NextResponse.json({ id: existing.id, existing: true }, { status: 200 })
    }

    // Lead novo
    const { data, error } = await supabase
      .from('leads')
      .insert({
        nome: nome.trim(),
        email: emailNorm,
        whatsapp: wppNorm,
        status_lead: 'frio',
        instagram: instagram?.trim() || null,
        profissao: profissao?.trim() || null,
        renda_mensal: renda_mensal?.trim() || null,
      })
      .select('id')
      .single()

    if (error) throw error

    // Ação 2a: agenda recuperação de quiz em 15 min
    try {
      await agendarTarefa({
        lead_id: data.id,
        tipo: 'recuperacao_quiz',
        payload: {},
        agendado_para: emMinutos(15),
      })
    } catch (e) {
      console.error('[leads] erro ao agendar recuperação:', e)
    }

    await dispararWebhookSaida('novo_lead', {
      lead_id: data.id,
      nome: nome.trim(),
      email: emailNorm,
      whatsapp: wppNorm,
    })

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/leads]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

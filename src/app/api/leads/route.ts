import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispararWebhookSaida } from '@/lib/webhooks'
import { agendarTarefa, emMinutos } from '@/lib/tarefas/agendar'

// Mascara WhatsApp: remove tudo que não é número
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

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    console.log('[leads] tentativa de insert:', { nome, email, whatsapp: sanitizeWhatsApp(whatsapp), instagram, profissao, renda_mensal })

    const { data, error } = await supabase
      .from('leads')
      .insert({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: sanitizeWhatsApp(whatsapp),
        status_lead: 'frio',
        instagram: instagram?.trim() || null,
        profissao: profissao?.trim() || null,
        renda_mensal: renda_mensal?.trim() || null,
      })
      .select('id')
      .single()

    console.log('[leads] resultado do insert:', { data, error })

    if (error) {
      console.log('[leads] erro detectado, code:', error.code, 'message:', error.message)

      // Email ou WhatsApp já cadastrado — atualiza os dados do lead existente
      if (error.code === '23505') {
        const { data: existing, error: findError } = await supabase
          .from('leads')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .single()

        console.log('[leads] lead existente encontrado:', { existing, findError })

        if (existing) {
          // Atualiza os campos do lead existente
          const { data: updatedData, error: updateError } = await supabase
            .from('leads')
            .update({
              nome: nome.trim(),
              instagram: instagram?.trim() || null,
              profissao: profissao?.trim() || null,
              renda_mensal: renda_mensal?.trim() || null,
            })
            .eq('id', existing.id)
            .select('id')
            .single()

          if (updateError) {
            console.error('[leads] erro ao atualizar lead existente:', updateError)
            throw updateError
          }

          console.log('[leads] lead atualizado com sucesso:', updatedData)
          return NextResponse.json({ id: existing.id, existing: true }, { status: 200 })
        }
      }
      throw error
    }

    console.log('[leads] novo lead criado com sucesso:', data.id)

    // Ação 2a: agendar recuperação de quiz abandonado em 15 min
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
      email: email.trim().toLowerCase(),
      whatsapp: sanitizeWhatsApp(whatsapp),
    })

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/leads]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

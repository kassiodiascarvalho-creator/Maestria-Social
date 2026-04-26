import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensagemWhatsApp } from '@/lib/meta'
import { enviarViaBaileys } from '@/lib/baileys'

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

export async function POST(req: NextRequest) {
  try {
    const { lead_ids, mensagem, canal, agente_id, delay_ms } = await req.json() as {
      lead_ids: string[]
      mensagem: string
      canal: 'baileys' | 'meta'
      agente_id?: string
      delay_ms?: number
    }

    if (!lead_ids?.length) return NextResponse.json({ error: 'lead_ids é obrigatório' }, { status: 400 })
    if (!mensagem?.trim()) return NextResponse.json({ error: 'mensagem é obrigatória' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any

    const { data: leads } = await supabase
      .from('leads')
      .select('id,nome,whatsapp')
      .in('id', lead_ids)

    if (!leads?.length) return NextResponse.json({ error: 'Nenhum lead encontrado' }, { status: 404 })

    const delayEntreMensagens = delay_ms ?? 3000
    const resultados: { id: string; nome: string; ok: boolean; erro?: string }[] = []

    for (const lead of leads) {
      if (!lead.whatsapp) {
        resultados.push({ id: lead.id, nome: lead.nome, ok: false, erro: 'sem WhatsApp' })
        continue
      }

      const para = normalizarTelefone(lead.whatsapp)

      const primeiroNome = (lead.nome as string).split(' ')[0]
      const mensagemPersonalizada = mensagem.replace(/\{nome\}/gi, primeiroNome)

      try {
        if (canal === 'meta') {
          await enviarMensagemWhatsApp(para, mensagemPersonalizada)
        } else {
          let enviado = false
          try {
            await enviarViaBaileys(para, mensagemPersonalizada)
            enviado = true
          } catch (errBaileys) {
            console.warn(`[reengajar] Baileys falhou para ${lead.nome}:`, errBaileys)
          }
          if (!enviado) {
            await enviarMensagemWhatsApp(para, mensagemPersonalizada)
          }
        }

        await supabase.from('conversas').insert({
          lead_id: lead.id,
          role: 'assistant',
          mensagem: mensagemPersonalizada,
        })

        const updateData: Record<string, unknown> = {
          ultima_atividade_humana: new Date().toISOString(),
          etiqueta: 'ia_atendendo',
        }
        if (agente_id) updateData.agente_id = agente_id

        await supabase.from('leads').update(updateData).eq('id', lead.id)

        resultados.push({ id: lead.id, nome: lead.nome, ok: true })
      } catch (err) {
        resultados.push({ id: lead.id, nome: lead.nome, ok: false, erro: String(err) })
      }

      if (delayEntreMensagens > 0) {
        await new Promise(r => setTimeout(r, delayEntreMensagens))
      }
    }

    const enviados = resultados.filter(r => r.ok).length
    const falhas = resultados.filter(r => !r.ok).length

    return NextResponse.json({ ok: true, enviados, falhas, resultados })
  } catch (err) {
    console.error('[reengajar]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarViaBaileys } from '@/lib/baileys'
import { enviarMensagemWhatsApp } from '@/lib/meta'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = createAdminClient() as any

  const { data: form } = await db
    .from('forms')
    .select('id, titulo, config, envio_email, envio_whatsapp, webhook_url')
    .eq('slug', slug)
    .eq('status', 'ativo')
    .single()

  if (!form) return NextResponse.json({ error: 'Formulário não encontrado' }, { status: 404 })

  // Rate limiting: máx 10 submissões concluídas por form nos últimos 60s (proteção anti-spam)
  const { count: submissoesRecentes } = await db
    .from('form_responses')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', form.id)
    .eq('concluido', true)
    .gte('criado_em', new Date(Date.now() - 60 * 1000).toISOString())

  if ((submissoesRecentes ?? 0) >= 10) {
    return NextResponse.json({ error: 'Muitas submissões. Tente novamente em alguns segundos.' }, { status: 429 })
  }

  const body = await req.json()
  const {
    respostas, response_id,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
  } = body as {
    respostas: { question_id: string; tipo: string; label: string; valor: string }[]
    response_id?: string
    utm_source?: string; utm_medium?: string; utm_campaign?: string
    utm_term?: string; utm_content?: string
  }

  // Extrai campos especiais para criar/atualizar o lead
  const nome  = respostas.find(r => r.tipo === 'nome')?.valor?.trim() || ''
  const email = respostas.find(r => r.tipo === 'email')?.valor?.trim() || ''
  const wpp   = respostas.find(r => r.tipo === 'whatsapp')?.valor?.replace(/\D/g, '') || ''

  // Cria ou localiza lead
  let leadId: string | null = null
  if (nome || email || wpp) {
    const leadData: Record<string, unknown> = {
      nome: nome || 'Anônimo', origem: form.titulo, form_id: form.id,
    }
    if (email) leadData.email = email
    if (wpp)   leadData.whatsapp = wpp
    if (utm_source) leadData.utm_source = utm_source

    let leadExistente = null
    if (wpp) {
      const { data } = await db.from('leads').select('id').eq('whatsapp', wpp).maybeSingle()
      leadExistente = data
    }
    if (!leadExistente && email) {
      const { data } = await db.from('leads').select('id').eq('email', email).maybeSingle()
      leadExistente = data
    }

    if (leadExistente) {
      await db.from('leads').update({ origem: form.titulo, form_id: form.id }).eq('id', leadExistente.id)
      leadId = leadExistente.id
    } else {
      const { data: novoLead } = await db.from('leads').insert(leadData).select('id').single()
      leadId = novoLead?.id ?? null
    }
  }

  const completude = respostas.length > 0
    ? Math.round((respostas.filter(r => r.valor?.trim()).length / respostas.length) * 100)
    : 0

  let responseIdFinal = response_id ?? null

  if (response_id) {
    // Atualiza sessão existente (criada no /start)
    await db.from('form_responses').update({
      lead_id: leadId, completude, concluido: true,
      utm_source: utm_source ?? null, utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      utm_term: utm_term ?? null, utm_content: utm_content ?? null,
    }).eq('id', response_id)
  } else {
    // Fallback: cria novo registro se não há sessão
    const { data: response } = await db.from('form_responses').insert({
      form_id: form.id, lead_id: leadId, completude, concluido: true,
      utm_source: utm_source ?? null, utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      utm_term: utm_term ?? null, utm_content: utm_content ?? null,
    }).select('id').single()
    responseIdFinal = response?.id ?? null
  }

  // Salva respostas individuais
  if (responseIdFinal && respostas.length > 0) {
    // Remove respostas anteriores se houver (resubmit da mesma sessão)
    await db.from('form_answers').delete().eq('response_id', responseIdFinal)
    const answers = respostas
      .filter(r => r.question_id)
      .map(r => ({ response_id: responseIdFinal, question_id: r.question_id, valor: r.valor ?? '' }))
    if (answers.length > 0) await db.from('form_answers').insert(answers)
  }

  // Incrementa contador
  await db.rpc('incrementar_total_respostas', { form_id_param: form.id }).catch(() =>
    db.from('forms').update({ atualizado_em: new Date().toISOString() }).eq('id', form.id)
  )

  // Notificação WhatsApp
  if (form.envio_whatsapp) {
    const resumo = respostas.slice(0, 5).map(r => `*${r.label}:* ${r.valor}`).join('\n')
    const msg = `📋 *Nova resposta — ${form.titulo}*\n\n${resumo}${respostas.length > 5 ? `\n_...e mais ${respostas.length - 5} respostas_` : ''}`
    try {
      const modo = await getConfig('WHATSAPP_MODE')
      const instanciaId = (await getConfig('BAILEYS_INSTANCIA_ID')) || '1'
      if (modo === 'baileys') await enviarViaBaileys(form.envio_whatsapp, msg, instanciaId)
      else await enviarMensagemWhatsApp(form.envio_whatsapp, msg)
    } catch { /* não crítico */ }
  }

  // Webhook externo
  if (form.webhook_url) {
    fetch(form.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_id: form.id, form_titulo: form.titulo, lead_id: leadId,
        respostas, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, lead_id: leadId, response_id: responseIdFinal })
}
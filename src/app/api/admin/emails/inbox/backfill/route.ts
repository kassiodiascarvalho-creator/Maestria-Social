import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/emails/inbox/backfill
// Importa histórico de email_logs → conversas_email + mensagens_email
// Idempotente: usa ON CONFLICT DO NOTHING (campanha_id, email_lead único)

export async function POST() {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // Busca todos os logs enviados com sucesso (exceto erro)
  const { data: logs, error } = await db
    .from('email_logs')
    .select('id, campanha_id, lead_id, email, nome, variante, resend_id, status, enviado_em, email_campanhas(nome, assunto_a, assunto_b, remetente_nome, remetente_email)')
    .neq('status', 'erro')
    .order('enviado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!logs?.length) return NextResponse.json({ importados: 0, msg: 'Nenhum log encontrado' })

  let importados = 0
  let ignorados = 0

  for (const log of logs) {
    const camp = log.email_campanhas
    const assunto = (log.variante === 'b' && camp?.assunto_b) ? camp.assunto_b : (camp?.assunto_a || '(sem assunto)')

    // Tenta criar a conversa (ON CONFLICT: ignora se já existe)
    const { data: conversa, error: errConv } = await db
      .from('conversas_email')
      .insert({
        lead_id: log.lead_id || null,
        campanha_id: log.campanha_id,
        email_lead: log.email,
        nome_lead: log.nome || null,
        assunto,
        status: 'aguardando',
        ultima_mensagem_em: log.enviado_em,
        criado_em: log.enviado_em,
      })
      .select('id')
      .single()

    if (errConv) {
      // Violação de unique (já existe) — busca a conversa existente
      const { data: existente } = await db
        .from('conversas_email')
        .select('id')
        .eq('campanha_id', log.campanha_id)
        .eq('email_lead', log.email)
        .single()

      if (existente) {
        // Verifica se já tem mensagem deste log
        const { count } = await db
          .from('mensagens_email')
          .select('id', { count: 'exact', head: true })
          .eq('conversa_id', existente.id)
          .eq('resend_message_id', log.resend_id || log.id)

        if (!count) {
          await db.from('mensagens_email').insert({
            conversa_id: existente.id,
            direcao: 'saida',
            de: `${camp?.remetente_nome || 'Maestria Social'} <${camp?.remetente_email || 'time@maestriasocial.com'}>`,
            corpo_texto: `[E-mail enviado em ${new Date(log.enviado_em).toLocaleString('pt-BR')}]`,
            lida: true,
            resend_message_id: log.resend_id || log.id,
            criado_em: log.enviado_em,
          })
        }
      }
      ignorados++
      continue
    }

    if (conversa?.id) {
      await db.from('mensagens_email').insert({
        conversa_id: conversa.id,
        direcao: 'saida',
        de: `${camp?.remetente_nome || 'Maestria Social'} <${camp?.remetente_email || 'time@maestriasocial.com'}>`,
        corpo_texto: `[E-mail enviado em ${new Date(log.enviado_em).toLocaleString('pt-BR')}]`,
        lida: true,
        resend_message_id: log.resend_id || log.id,
        criado_em: log.enviado_em,
      })
      importados++
    }
  }

  return NextResponse.json({ ok: true, importados, ignorados, total: logs.length })
}

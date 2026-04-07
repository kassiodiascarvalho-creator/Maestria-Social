import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensagemWhatsApp } from '@/lib/meta'
import { enviarEmail } from '@/lib/email/enviar'
import {
  emailDia0,
  emailDia1,
  emailDia3,
  emailDia5,
  emailDia7,
  type EmailTemplate,
} from '@/lib/email/templates'
import type { Lead } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TENTATIVAS = 3
const LOTE = 20

type Tarefa = {
  id: string
  lead_id: string | null
  tipo: 'whatsapp_msg' | 'email' | 'recuperacao_quiz'
  payload: Record<string, unknown>
  tentativas: number
}

function autorizado(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true // dev
  const auth = req.headers.get('authorization') || ''
  if (auth === `Bearer ${expected}`) return true
  if (req.nextUrl.searchParams.get('secret') === expected) return true
  return false
}

function emailPorTemplate(nome: string, lead: Lead): EmailTemplate | null {
  switch (nome) {
    case 'dia_0':
      return emailDia0(lead)
    case 'dia_1':
      return emailDia1(lead)
    case 'dia_3':
      return emailDia3(lead)
    case 'dia_5':
      return emailDia5(lead)
    case 'dia_7':
      return emailDia7(lead)
    default:
      return null
  }
}

async function buscarLead(leadId: string): Promise<Lead | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('leads').select('*').eq('id', leadId).single()
  return (data as Lead | null) ?? null
}

async function executar(t: Tarefa): Promise<void> {
  const supabase = createAdminClient()
  if (!t.lead_id) throw new Error('lead_id ausente')
  const lead = await buscarLead(t.lead_id)
  if (!lead) throw new Error(`lead ${t.lead_id} não encontrado`)

  if (t.tipo === 'whatsapp_msg') {
    const texto = String(t.payload.texto || '')
    if (!texto) throw new Error('payload.texto ausente')
    await enviarMensagemWhatsApp(lead.whatsapp, texto)
    await supabase.from('conversas').insert({
      lead_id: lead.id,
      role: 'assistant',
      mensagem: texto,
    })
    return
  }

  if (t.tipo === 'email') {
    const tpl = String(t.payload.template || '')
    const email = emailPorTemplate(tpl, lead)
    if (!email) throw new Error(`template "${tpl}" desconhecido`)
    await enviarEmail({
      para: lead.email,
      assunto: email.assunto,
      html: email.html,
      texto: email.texto,
    })
    return
  }

  if (t.tipo === 'recuperacao_quiz') {
    if (lead.qs_total) return // já fez quiz, ignora
    const linkBase = 'https://maestria-social.vercel.app/quiz'
    const texto =
      String(t.payload.texto || '') ||
      `Oi ${lead.nome}! Vi que você começou o Teste de Quociente Social mas não terminou. Leva uns 4 minutos e o resultado te mostra exatamente onde mirar primeiro: ${linkBase}`
    // tenta WhatsApp primeiro
    try {
      await enviarMensagemWhatsApp(lead.whatsapp, texto)
      await supabase.from('conversas').insert({
        lead_id: lead.id,
        role: 'assistant',
        mensagem: texto,
      })
    } catch {
      await enviarEmail({
        para: lead.email,
        assunto: `${lead.nome}, faltou pouco para seu resultado`,
        html: `<p>${texto}</p>`,
        texto,
      })
    }
    return
  }

  throw new Error(`tipo desconhecido: ${t.tipo}`)
}

export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const agora = new Date().toISOString()

  const { data: tarefas, error } = await supabase
    .from('tarefas_agendadas')
    .select('id, lead_id, tipo, payload, tentativas')
    .eq('status', 'pendente')
    .lte('agendado_para', agora)
    .order('agendado_para', { ascending: true })
    .limit(LOTE)

  if (error) {
    console.error('[cron/processar-tarefas]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const lista = (tarefas ?? []) as Tarefa[]
  let ok = 0
  let fail = 0

  for (const t of lista) {
    try {
      await executar(t)
      await supabase
        .from('tarefas_agendadas')
        .update({ status: 'enviada', processado_em: new Date().toISOString() })
        .eq('id', t.id)
      ok++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro'
      const tentativas = t.tentativas + 1
      const status = tentativas >= MAX_TENTATIVAS ? 'erro' : 'pendente'
      await supabase
        .from('tarefas_agendadas')
        .update({
          status,
          tentativas,
          ultimo_erro: msg,
          processado_em: status === 'erro' ? new Date().toISOString() : null,
        })
        .eq('id', t.id)
      fail++
      console.error('[cron/processar-tarefas] tarefa', t.id, msg)
    }
  }

  return NextResponse.json({ processadas: lista.length, ok, fail })
}

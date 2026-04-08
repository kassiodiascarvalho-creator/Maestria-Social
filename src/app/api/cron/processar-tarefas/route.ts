import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarMensagemWhatsApp, enviarTemplateWhatsApp } from '@/lib/meta'
import { enviarEmail } from '@/lib/email/enviar'
import { getConfig } from '@/lib/config'
import type { Lead } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TENTATIVAS = 3
const LOTE = 20
const SITE_URL = 'https://maestria-social.vercel.app'

type Tarefa = {
  id: string
  lead_id: string | null
  tipo: 'whatsapp_msg' | 'email' | 'recuperacao_quiz'
  payload: Record<string, unknown>
  tentativas: number
}

function autorizado(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const auth = req.headers.get('authorization') || ''
  if (auth === `Bearer ${expected}`) return true
  if (req.nextUrl.searchParams.get('secret') === expected) return true
  return false
}

// Substitui variáveis {nome}, {qs_total}, etc no template
function resolverVariaveis(texto: string, lead: Lead): string {
  return texto
    .replace(/{nome}/g, lead.nome)
    .replace(/{qs_total}/g, String(lead.qs_total ?? 0))
    .replace(/{qs_percentual}/g, String(lead.qs_percentual ?? 0))
    .replace(/{nivel_qs}/g, lead.nivel_qs ?? '')
    .replace(/{pilar_fraco}/g, lead.pilar_fraco ?? '')
    .replace(/{link_resultado}/g, `${SITE_URL}/resultado/${lead.id}`)
}

// Converte 'dia_0' → 0, 'dia_1' → 1, etc
function diaDoTemplate(tpl: string): number {
  const match = tpl.match(/dia_(\d+)/)
  return match ? parseInt(match[1]) : 0
}

async function buscarEmailTemplate(pilar: string, dia: number): Promise<{ assunto: string; corpo_html: string } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('email_templates')
    .select('assunto, corpo_html')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('pilar', pilar as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('dia', dia as any)
    .eq('ativo', true)
    .single()
  return data ?? null
}

function wrapEmailHtml(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#0e0f09;font-family:Arial,sans-serif;color:#fff9e6;">
  <div style="max-width:600px;margin:0 auto;padding:0;">

    <!-- Header com logo -->
    <div style="background:#111009;border-bottom:1px solid #2a1f18;padding:24px 32px;display:flex;align-items:center;gap:14px;">
      <img src="https://i.imgur.com/mJZwwpe.png" alt="Maestria Social" width="44" height="44" style="border-radius:10px;display:block;" />
      <div>
        <div style="font-size:13px;font-weight:700;color:#c2904d;letter-spacing:2px;text-transform:uppercase;">Maestria Social</div>
        <div style="font-size:11px;color:#4a3e30;margin-top:2px;">Inteligência Social aplicada</div>
      </div>
    </div>

    <!-- Conteúdo -->
    <div style="padding:36px 32px;">
      <h1 style="font-size:26px;line-height:1.2;color:#fff9e6;margin:0 0 18px;">${titulo}</h1>
      <div style="font-size:15px;line-height:1.7;color:#cdbfa8;">${corpo}</div>
      <div style="margin-top:28px;">
        <a href="https://maestriasocial.com" style="display:inline-block;background:#c2904d;color:#0e0f09;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;">
          Conversar no WhatsApp →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #2a1f18;padding:20px 32px;display:flex;align-items:center;gap:12px;">
      <img src="https://i.imgur.com/mJZwwpe.png" alt="" width="24" height="24" style="border-radius:6px;opacity:.5;" />
      <p style="margin:0;font-size:12px;color:#4a3e30;">© Maestria Social · <a href="https://maestriasocial.com" style="color:#4a3e30;text-decoration:none;">maestriasocial.com</a></p>
    </div>

  </div>
</body></html>`
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
    const textoResolvido = resolverVariaveis(texto, lead)

    // Tenta enviar via template se configurado (para contato business-initiated)
    const diaKey = String(t.payload.dia || '')
    const templateMap: Record<string, string> = {
      '1': 'maestria_followup_d1',
      '3': 'maestria_followup_d3',
      '7': 'maestria_followup_d7',
    }
    const templatePadrao = templateMap[diaKey]
    const templateCustom = templatePadrao ? await getConfig(`META_TEMPLATE_${diaKey.toUpperCase()}`) : null
    const nomeTemplate = templateCustom || templatePadrao

    let enviado = false
    if (nomeTemplate) {
      try {
        const params = [lead.nome, String(lead.qs_total ?? 0), lead.pilar_fraco ?? 'Comunicação']
        await enviarTemplateWhatsApp(lead.whatsapp, nomeTemplate, params)
        enviado = true
      } catch {
        // fallback para texto livre abaixo
      }
    }

    if (!enviado) {
      await enviarMensagemWhatsApp(lead.whatsapp, textoResolvido)
    }

    await supabase.from('conversas').insert({
      lead_id: lead.id,
      role: 'assistant',
      mensagem: textoResolvido,
    })
    return
  }

  if (t.tipo === 'email') {
    const tplNome = String(t.payload.template || '')
    const dia = diaDoTemplate(tplNome)
    const pilar = lead.pilar_fraco || 'Comunicação'

    // Busca template no banco (segmentado por pilar)
    const tpl = await buscarEmailTemplate(pilar, dia)
    if (!tpl) throw new Error(`Template não encontrado: pilar=${pilar} dia=${dia}`)

    const assuntoResolvido = resolverVariaveis(tpl.assunto, lead)
    const corpoResolvido = resolverVariaveis(tpl.corpo_html, lead)
    const html = wrapEmailHtml(assuntoResolvido, corpoResolvido)

    await enviarEmail({
      para: lead.email,
      assunto: assuntoResolvido,
      html,
      texto: `${assuntoResolvido} — Acesse: ${SITE_URL}/resultado/${lead.id}`,
    })
    return
  }

  if (t.tipo === 'recuperacao_quiz') {
    if (lead.qs_total) return // já fez quiz, ignora
    const linkBase = `${SITE_URL}/quiz`
    const texto = String(t.payload.texto || '')
      || `Oi ${lead.nome}! Vi que você começou o Teste de Quociente Social mas não terminou. Leva uns 4 minutos e o resultado te mostra exatamente onde mirar primeiro: ${linkBase}`
    try {
      await enviarMensagemWhatsApp(lead.whatsapp, texto)
      await supabase.from('conversas').insert({ lead_id: lead.id, role: 'assistant', mensagem: texto })
    } catch {
      await enviarEmail({
        para: lead.email,
        assunto: `${lead.nome}, faltou pouco para seu resultado`,
        html: wrapEmailHtml(`${lead.nome}, faltou pouco`, `<p>${texto}</p>`),
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
        .update({ status, tentativas, ultimo_erro: msg, processado_em: status === 'erro' ? new Date().toISOString() : null })
        .eq('id', t.id)
      fail++
    }
  }

  return NextResponse.json({ processadas: lista.length, ok, fail })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

type TipoMensagem = 'text' | 'image' | 'audio' | 'video' | 'document' | 'template'

interface MensagemItem {
  tipo: TipoMensagem
  conteudo?: string
  caption?: string
  filename?: string
  template_name?: string
  template_lang?: string
  template_vars?: string[]
}

interface Contato {
  id: string
  nome: string | null
  telefone: string
}

function buildPayload(
  telefone: string,
  msg: MensagemItem
): Record<string, unknown> {
  const to = normalizarTelefone(telefone)

  if (msg.tipo === 'template') {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: msg.template_name,
        language: { code: msg.template_lang || 'pt_BR' },
        ...(msg.template_vars && msg.template_vars.length > 0
          ? {
              components: [{
                type: 'body',
                parameters: msg.template_vars.map(v => ({ type: 'text', text: v })),
              }],
            }
          : {}),
      },
    }
  }

  if (msg.tipo === 'text') {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: msg.conteudo },
    }
  }

  if (msg.tipo === 'audio') {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'audio',
      audio: { link: msg.conteudo },
    }
  }

  if (msg.tipo === 'image') {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link: msg.conteudo, ...(msg.caption ? { caption: msg.caption } : {}) },
    }
  }

  if (msg.tipo === 'video') {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'video',
      video: { link: msg.conteudo, ...(msg.caption ? { caption: msg.caption } : {}) },
    }
  }

  // document
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: {
      link: msg.conteudo,
      ...(msg.filename ? { filename: msg.filename } : {}),
      ...(msg.caption ? { caption: msg.caption } : {}),
    },
  }
}

async function enviarMeta(
  phoneNumberId: string,
  accessToken: string,
  telefone: string,
  msg: MensagemItem
): Promise<void> {
  const body = buildPayload(telefone, msg)
  const res = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API: ${err}`)
  }
}

// POST — dispara sequência de mensagens para todos os contatos de uma lista
// body: { lista_id, mensagens: MensagemItem[] }
// Compatibilidade: aceita formato antigo { lista_id, tipo, conteudo, ... }
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const lista_id: string = payload.lista_id

    // Compatibilidade com formato antigo (tipo + conteudo)
    let mensagens: MensagemItem[]
    if (Array.isArray(payload.mensagens) && payload.mensagens.length > 0) {
      mensagens = payload.mensagens
    } else if (payload.tipo && payload.conteudo) {
      mensagens = [{
        tipo: payload.tipo,
        conteudo: payload.conteudo,
        caption: payload.caption,
        filename: payload.filename,
      }]
    } else {
      return NextResponse.json({ error: 'mensagens[] obrigatório' }, { status: 400 })
    }

    if (!lista_id) return NextResponse.json({ error: 'lista_id obrigatório' }, { status: 400 })

    const phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
    const accessToken = await getConfig('META_ACCESS_TOKEN')
    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ error: 'META_PHONE_NUMBER_ID ou META_ACCESS_TOKEN não configurados' }, { status: 500 })
    }

    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: lista } = await db
      .from('wpp_listas')
      .select('nome')
      .eq('id', lista_id)
      .single()

    const { data: contatos, error: contatosErr } = await db
      .from('wpp_contatos')
      .select('id, nome, telefone')
      .eq('lista_id', lista_id)

    if (contatosErr) return NextResponse.json({ error: contatosErr.message }, { status: 500 })
    if (!contatos || contatos.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato nesta lista' }, { status: 400 })
    }

    let enviados = 0
    let falhas = 0
    const erros: string[] = []

    // Para cada contato, envia todas as mensagens na ordem
    for (const contato of contatos as Contato[]) {
      let contatoOk = true
      for (const msg of mensagens) {
        try {
          await enviarMeta(phoneNumberId, accessToken, contato.telefone, msg)
        } catch (err) {
          contatoOk = false
          erros.push(`${contato.telefone}: ${err instanceof Error ? err.message : String(err)}`)
          break // se uma msg falhar, pula pro próximo contato
        }
        // delay entre msgs do mesmo contato
        if (mensagens.length > 1) {
          await new Promise(r => setTimeout(r, 200))
        }
      }
      if (contatoOk) enviados++
      else falhas++
      // delay entre contatos
      await new Promise(r => setTimeout(r, 300))
    }

    // Registra disparo
    const resumo = mensagens.map(m => m.tipo === 'template' ? `template:${m.template_name}` : m.tipo).join(' + ')
    await db.from('wpp_disparos').insert({
      lista_id,
      lista_nome: lista?.nome ?? '',
      tipo: mensagens.length === 1 ? mensagens[0].tipo : 'sequence',
      conteudo: mensagens.length === 1 ? (mensagens[0].conteudo ?? mensagens[0].template_name ?? '') : resumo,
      caption: mensagens[0]?.caption ?? null,
      filename: mensagens[0]?.filename ?? null,
      total: contatos.length,
      enviados,
      falhas,
    })

    return NextResponse.json({ ok: true, total: contatos.length, enviados, falhas, erros })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

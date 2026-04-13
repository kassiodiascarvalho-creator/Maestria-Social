import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

type TipoMensagem = 'text' | 'image' | 'audio' | 'video' | 'document'

interface Contato {
  id: string
  nome: string | null
  telefone: string
}

async function enviarMensagemMeta(
  phoneNumberId: string,
  accessToken: string,
  telefone: string,
  tipo: TipoMensagem,
  conteudo: string,
  caption?: string,
  filename?: string
): Promise<void> {
  let body: Record<string, unknown>

  if (tipo === 'text') {
    body = {
      messaging_product: 'whatsapp',
      to: normalizarTelefone(telefone),
      type: 'text',
      text: { body: conteudo },
    }
  } else if (tipo === 'audio') {
    body = {
      messaging_product: 'whatsapp',
      to: normalizarTelefone(telefone),
      type: 'audio',
      audio: { link: conteudo },
    }
  } else if (tipo === 'image') {
    body = {
      messaging_product: 'whatsapp',
      to: normalizarTelefone(telefone),
      type: 'image',
      image: { link: conteudo, ...(caption ? { caption } : {}) },
    }
  } else if (tipo === 'video') {
    body = {
      messaging_product: 'whatsapp',
      to: normalizarTelefone(telefone),
      type: 'video',
      video: { link: conteudo, ...(caption ? { caption } : {}) },
    }
  } else {
    // document
    body = {
      messaging_product: 'whatsapp',
      to: normalizarTelefone(telefone),
      type: 'document',
      document: {
        link: conteudo,
        ...(filename ? { filename } : {}),
        ...(caption ? { caption } : {}),
      },
    }
  }

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

// POST — dispara mensagem para todos os contatos de uma lista
// body: { lista_id, tipo, conteudo, caption?, filename? }
export async function POST(req: NextRequest) {
  try {
    const { lista_id, tipo, conteudo, caption, filename } = await req.json() as {
      lista_id: string
      tipo: TipoMensagem
      conteudo: string
      caption?: string
      filename?: string
    }

    if (!lista_id) return NextResponse.json({ error: 'lista_id obrigatório' }, { status: 400 })
    if (!tipo) return NextResponse.json({ error: 'tipo obrigatório' }, { status: 400 })
    if (!conteudo?.trim()) return NextResponse.json({ error: 'conteudo obrigatório' }, { status: 400 })

    const phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
    const accessToken = await getConfig('META_ACCESS_TOKEN')
    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ error: 'META_PHONE_NUMBER_ID ou META_ACCESS_TOKEN não configurados' }, { status: 500 })
    }

    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Busca dados da lista
    const { data: lista } = await db
      .from('wpp_listas')
      .select('nome')
      .eq('id', lista_id)
      .single()

    // Busca contatos
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

    // Envio sequencial com delay de 300ms para respeitar rate limits da Meta
    for (const contato of contatos as Contato[]) {
      try {
        await enviarMensagemMeta(phoneNumberId, accessToken, contato.telefone, tipo, conteudo, caption, filename)
        enviados++
      } catch (err) {
        falhas++
        erros.push(`${contato.telefone}: ${err instanceof Error ? err.message : String(err)}`)
      }
      // delay entre envios para evitar bloqueio
      await new Promise(r => setTimeout(r, 300))
    }

    // Registra disparo no histórico
    await db.from('wpp_disparos').insert({
      lista_id,
      lista_nome: lista?.nome ?? '',
      tipo,
      conteudo,
      caption: caption ?? null,
      filename: filename ?? null,
      total: contatos.length,
      enviados,
      falhas,
    })

    return NextResponse.json({ ok: true, total: contatos.length, enviados, falhas, erros })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

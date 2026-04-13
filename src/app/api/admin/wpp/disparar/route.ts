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

interface Filtros {
  pilar?: string
  nivel?: string
  status?: string
  janela?: string
  renda?: string
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

// POST — dispara sequência de mensagens para contatos filtrados de uma lista
// body: { lista_id, mensagens: MensagemItem[], filtros?: Filtros }
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const lista_id: string = payload.lista_id
    const filtros: Filtros = payload.filtros ?? {}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any

    // Verifica se é lista de leads
    const { data: listaInfo } = await db
      .from('wpp_listas')
      .select('nome, is_leads')
      .eq('id', lista_id)
      .single()

    const isLeads = listaInfo?.is_leads === true

    // Busca template padrão para contatos fora da janela 24h
    const templatePadrao = await getConfig('META_TEMPLATE_NAME')

    // ── Busca contatos com dados necessários para filtros e janela 24h ──
    let contatosFiltrados: Array<{
      id: string
      nome: string | null
      telefone: string
      dentro_24h: boolean
      lead_id?: string
    }>

    const agora = Date.now()
    const VINTE_QUATRO_H = 24 * 60 * 60 * 1000

    if (isLeads) {
      // Busca com join de leads (mesma lógica do GET contatos)
      const { data: contatos, error: contatosErr } = await db
        .from('wpp_contatos')
        .select('id, nome, telefone, criado_em, ultima_msg_user, lead_id, leads:lead_id(id, pilar_fraco, nivel_qs, status_lead, renda_mensal)')
        .eq('lista_id', lista_id)
        .order('criado_em', { ascending: true })

      if (contatosErr) return NextResponse.json({ error: contatosErr.message }, { status: 500 })
      if (!contatos || contatos.length === 0) {
        return NextResponse.json({ error: 'Nenhum contato nesta lista' }, { status: 400 })
      }

      // Fallback: para leads sem ultima_msg_user, busca última conversa role='user'
      const leadIds = (contatos ?? [])
        .filter((c: Record<string, unknown>) => c.lead_id && !c.ultima_msg_user)
        .map((c: Record<string, unknown>) => c.lead_id as string)

      let conversaFallback: Record<string, string> = {}
      if (leadIds.length > 0) {
        const supabaseTyped = createAdminClient()
        const { data: convs } = await supabaseTyped
          .from('conversas')
          .select('lead_id, criado_em')
          .in('lead_id', leadIds)
          .eq('role', 'user')
          .order('criado_em', { ascending: false })

        if (convs) {
          for (const cv of convs) {
            if (!conversaFallback[cv.lead_id]) {
              conversaFallback[cv.lead_id] = cv.criado_em
            }
          }
        }
      }

      // Mapeia e calcula dentro_24h
      type ContatoLead = { id: string; nome: string | null; telefone: string; dentro_24h: boolean; lead_id?: string; pilar_fraco: string | null; nivel_qs: string | null; status_lead: string | null; renda_mensal: string | null }
      let resultado: ContatoLead[] = (contatos ?? []).map((c: Record<string, unknown>) => {
        const lead = c.leads as Record<string, unknown> | null
        let ultimaMsg = c.ultima_msg_user as string | null
        if (!ultimaMsg && c.lead_id) {
          ultimaMsg = conversaFallback[c.lead_id as string] ?? null
        }
        const dentroDa24h = ultimaMsg ? (agora - new Date(ultimaMsg).getTime()) < VINTE_QUATRO_H : false

        return {
          id: c.id as string,
          nome: c.nome as string | null,
          telefone: c.telefone as string,
          dentro_24h: dentroDa24h,
          lead_id: c.lead_id as string | undefined,
          pilar_fraco: lead?.pilar_fraco as string | null ?? null,
          nivel_qs: lead?.nivel_qs as string | null ?? null,
          status_lead: lead?.status_lead as string | null ?? null,
          renda_mensal: lead?.renda_mensal as string | null ?? null,
        }
      })

      // Aplica filtros (mesma lógica do GET contatos)
      if (filtros.pilar) {
        resultado = resultado.filter(c => c.pilar_fraco === filtros.pilar)
      }
      if (filtros.nivel) {
        resultado = resultado.filter(c => c.nivel_qs === filtros.nivel)
      }
      if (filtros.status) {
        resultado = resultado.filter(c => c.status_lead === filtros.status)
      }
      if (filtros.renda) {
        resultado = resultado.filter(c => c.renda_mensal === filtros.renda)
      }
      if (filtros.janela === 'dentro') {
        resultado = resultado.filter(c => c.dentro_24h === true)
      } else if (filtros.janela === 'fora') {
        resultado = resultado.filter(c => c.dentro_24h === false)
      }

      contatosFiltrados = resultado
    } else {
      // Lista normal — sem filtros de leads, mas calcula dentro_24h
      const { data: contatos, error: contatosErr } = await db
        .from('wpp_contatos')
        .select('id, nome, telefone, ultima_msg_user')
        .eq('lista_id', lista_id)

      if (contatosErr) return NextResponse.json({ error: contatosErr.message }, { status: 500 })
      if (!contatos || contatos.length === 0) {
        return NextResponse.json({ error: 'Nenhum contato nesta lista' }, { status: 400 })
      }

      contatosFiltrados = (contatos ?? []).map((c: Record<string, unknown>) => {
        const ultimaMsg = c.ultima_msg_user as string | null
        return {
          id: c.id as string,
          nome: c.nome as string | null,
          telefone: c.telefone as string,
          dentro_24h: ultimaMsg ? (agora - new Date(ultimaMsg).getTime()) < VINTE_QUATRO_H : false,
        }
      })
    }

    if (contatosFiltrados.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato encontrado com os filtros aplicados' }, { status: 400 })
    }

    // ── Envia mensagens ──
    let enviados = 0
    let falhas = 0
    const erros: string[] = []

    for (const contato of contatosFiltrados) {
      let contatoOk = true

      if (contato.dentro_24h) {
        // Dentro da janela 24h: envia mensagens normais
        for (const msg of mensagens) {
          try {
            await enviarMeta(phoneNumberId, accessToken, contato.telefone, msg)
          } catch (err) {
            contatoOk = false
            erros.push(`${contato.telefone}: ${err instanceof Error ? err.message : String(err)}`)
            break
          }
          if (mensagens.length > 1) {
            await new Promise(r => setTimeout(r, 200))
          }
        }
      } else {
        // Fora da janela 24h: precisa enviar template primeiro
        // Verifica se já tem template na fila de mensagens
        const temTemplate = mensagens.some(m => m.tipo === 'template')

        if (temTemplate) {
          // Já tem template na fila — envia tudo normalmente
          // (template abre a janela, msgs seguintes passam)
          for (const msg of mensagens) {
            try {
              await enviarMeta(phoneNumberId, accessToken, contato.telefone, msg)
            } catch (err) {
              contatoOk = false
              erros.push(`${contato.telefone}: ${err instanceof Error ? err.message : String(err)}`)
              break
            }
            if (mensagens.length > 1) {
              await new Promise(r => setTimeout(r, 200))
            }
          }
        } else if (templatePadrao) {
          // Envia template padrão primeiro para abrir a janela, depois as mensagens
          try {
            await enviarMeta(phoneNumberId, accessToken, contato.telefone, {
              tipo: 'template',
              template_name: templatePadrao,
              template_lang: 'pt_BR',
            })
            // Aguarda um pouco para o template ser processado
            await new Promise(r => setTimeout(r, 500))

            // Agora envia as mensagens normais
            for (const msg of mensagens) {
              try {
                await enviarMeta(phoneNumberId, accessToken, contato.telefone, msg)
              } catch (err) {
                // Se falhar após template, registra mas continua
                erros.push(`${contato.telefone} (pós-template): ${err instanceof Error ? err.message : String(err)}`)
              }
              if (mensagens.length > 1) {
                await new Promise(r => setTimeout(r, 200))
              }
            }
          } catch (err) {
            contatoOk = false
            erros.push(`${contato.telefone} (template): ${err instanceof Error ? err.message : String(err)}`)
          }
        } else {
          // Sem template configurado — tenta enviar assim mesmo (Meta vai rejeitar msgs normais fora da janela)
          // Mas pelo menos tenta, caso o usuário tenha templates inline
          for (const msg of mensagens) {
            try {
              await enviarMeta(phoneNumberId, accessToken, contato.telefone, msg)
            } catch (err) {
              contatoOk = false
              erros.push(`${contato.telefone} (fora 24h, sem template): ${err instanceof Error ? err.message : String(err)}`)
              break
            }
            if (mensagens.length > 1) {
              await new Promise(r => setTimeout(r, 200))
            }
          }
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
      lista_nome: listaInfo?.nome ?? '',
      tipo: mensagens.length === 1 ? mensagens[0].tipo : 'sequence',
      conteudo: mensagens.length === 1 ? (mensagens[0].conteudo ?? mensagens[0].template_name ?? '') : resumo,
      caption: mensagens[0]?.caption ?? null,
      filename: mensagens[0]?.filename ?? null,
      total: contatosFiltrados.length,
      enviados,
      falhas,
    })

    return NextResponse.json({ ok: true, total: contatosFiltrados.length, enviados, falhas, erros })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

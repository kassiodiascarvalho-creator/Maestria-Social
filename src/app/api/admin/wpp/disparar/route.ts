import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

const META_API_URL = 'https://graph.facebook.com/v21.0'
const ZAPI_BASE_URL = 'https://api.z-api.io/instances'

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

function variacoesTelefone(tel: string): string[] {
  const digits = tel.replace(/\D/g, '')
  const full = digits.startsWith('55') ? digits : `55${digits}`
  const short = full.slice(2)
  const vars = new Set([tel, full, short])
  if (short.length === 10) {
    const com9 = `${short.slice(0, 2)}9${short.slice(2)}`
    vars.add(com9)
    vars.add(`55${com9}`)
  } else if (short.length === 11) {
    const sem9 = `${short.slice(0, 2)}${short.slice(3)}`
    vars.add(sem9)
    vars.add(`55${sem9}`)
  }
  return Array.from(vars).filter(Boolean)
}

// ── Baileys ────────────────────────────────────────────────────────────────────
async function enviarBaileys(
  apiUrl: string,
  telefone: string,
  msg: MensagemItem,
  instanceId = '1'
): Promise<void> {
  if (msg.tipo === 'template') return // Baileys não usa templates Meta

  const body: Record<string, unknown> = {
    phone: normalizarTelefone(telefone),
    type: msg.tipo,
    content: msg.conteudo,
  }
  if (msg.caption) body.caption = msg.caption
  if (msg.filename) body.filename = msg.filename

  // Usa rota de instância específica se disponível, senão rota legada
  const base = apiUrl.replace(/\/$/, '')
  const url = `${base}/instancia/${instanceId}/disparar`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Baileys: ${err}`)
  }
}

// ── Z-API ──────────────────────────────────────────────────────────────────────
async function enviarZApi(
  instanceId: string,
  token: string,
  clientToken: string | null,
  telefone: string,
  msg: MensagemItem
): Promise<void> {
  const phone = normalizarTelefone(telefone)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientToken) headers['Client-Token'] = clientToken

  let endpoint: string
  let body: Record<string, unknown>

  if (msg.tipo === 'text') {
    endpoint = 'send-text'
    body = { phone, message: msg.conteudo }
  } else if (msg.tipo === 'image') {
    endpoint = 'send-image'
    body = { phone, image: msg.conteudo, caption: msg.caption || '' }
  } else if (msg.tipo === 'audio') {
    endpoint = 'send-audio'
    body = { phone, audio: msg.conteudo }
  } else if (msg.tipo === 'video') {
    endpoint = 'send-video'
    body = { phone, video: msg.conteudo, caption: msg.caption || '' }
  } else if (msg.tipo === 'document') {
    endpoint = 'send-document'
    body = { phone, document: msg.conteudo, fileName: msg.filename || 'arquivo' }
  } else {
    // Template não suportado na Z-API — pula
    return
  }

  const url = `${ZAPI_BASE_URL}/${instanceId}/token/${token}/${endpoint}`
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Z-API: ${err}`)
  }
}

type TipoMensagem = 'text' | 'image' | 'audio' | 'video' | 'document' | 'template'

interface MensagemItem {
  tipo: TipoMensagem
  conteudo?: string
  variacoes?: string[] // variações adicionais de texto para sortear por contato
  caption?: string
  filename?: string
  template_name?: string
  template_lang?: string
  template_vars?: string[]
  template_param_count?: number // número real de {{N}} no template
}

// Sorteia aleatoriamente uma variação de texto por contato.
// Pool = [conteudo, ...variacoes] — filtra vazios.
function sortearTexto(msg: MensagemItem): string {
  if (msg.tipo !== 'text') return msg.conteudo ?? ''
  const opcoes = [msg.conteudo ?? '', ...(msg.variacoes ?? [])].filter(v => v.trim() !== '')
  if (opcoes.length === 0) return ''
  return opcoes[Math.floor(Math.random() * opcoes.length)]
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

// Substitui variáveis de personalização em texto livre.
// Suporta: {{nome}}, {{pilar}}, {{nivel}}, {{renda}}, {{score}}, {{status}}
function substituirVariaveis(
  texto: string,
  contato: Record<string, unknown>
): string {
  return texto
    .replace(/\{\{nome\}\}/gi, (contato.nome as string) || 'Lead')
    .replace(/\{\{pilar\}\}/gi, (contato.pilar_fraco as string) || 'N/A')
    .replace(/\{\{nivel\}\}/gi, (contato.nivel_qs as string) || 'N/A')
    .replace(/\{\{renda\}\}/gi, (contato.renda_mensal as string) || 'N/A')
    .replace(/\{\{score\}\}/gi, String(contato.qs_total ?? 0))
    .replace(/\{\{status\}\}/gi, (contato.status_lead as string) || 'N/A')
}

// Preenche variáveis vazias de um template com dados do contato como fallback.
// Usa template_param_count para saber quantas vars o template realmente tem.
// Pool de vars disponíveis (na ordem): nome, qs_total, pilar_fraco
function preencherVarsTemplate(
  msg: MensagemItem,
  contato: Record<string, unknown>
): MensagemItem {
  if (msg.tipo !== 'template') return msg
  // Se já tem variáveis preenchidas manualmente, usa elas
  if (msg.template_vars && msg.template_vars.some(v => v.trim() !== '')) return msg

  const nome = (contato.nome as string) || 'Lead'
  const qs_total = String(contato.qs_total ?? 0)
  const pilar = (contato.pilar_fraco as string) || 'N/A'
  const pool = [nome, qs_total, pilar]

  // Quantas variáveis o template tem
  // 0 = não foi informado → não envia componentes (evita erro de contagem na Meta)
  const count = msg.template_param_count ?? 0
  const vars = count > 0 ? pool.slice(0, Math.min(count, pool.length)) : []

  return { ...msg, template_vars: vars }
}

// Sincroniza todos os contatos de uma lista como leads.
// Detecta leads existentes por VARIAÇÕES de telefone (evita duplicatas de formato).
// Vincula wpp_contatos.lead_id para que o webhook Baileys encontre o lead correto.
async function sincronizarContatosComoLeads(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  listaId: string,
  listaNome: string,
): Promise<void> {
  try {
    const { data: contatos } = await db
      .from('wpp_contatos')
      .select('id, nome, telefone')
      .eq('lista_id', listaId)

    if (!contatos?.length) return

    type Contato = { id: string; nome: string | null; telefone: string }

    // Pré-calcula variações de telefone para cada contato
    const contatosDados = (contatos as Contato[]).map(c => ({
      ...c,
      vars: variacoesTelefone(c.telefone),
      normalizado: normalizarTelefone(c.telefone),
    }))

    // Batch: busca leads existentes por TODAS as variações de uma vez
    const todasVars = [...new Set(contatosDados.flatMap(c => c.vars))]
    const { data: leadsExistentes } = await db
      .from('leads')
      .select('id, whatsapp')
      .in('whatsapp', todasVars)

    // Mapa bidirecional: qualquer variação de telefone → lead_id
    const mapaVar2Lead: Record<string, string> = {}
    for (const l of (leadsExistentes ?? []) as Array<{ id: string; whatsapp: string }>) {
      for (const v of variacoesTelefone(l.whatsapp)) {
        mapaVar2Lead[v] = l.id
      }
    }

    for (const c of contatosDados) {
      const nome = c.nome?.trim() || 'Contato'

      // Procura se já existe lead com alguma variação do telefone
      let leadId: string | null = null
      for (const v of c.vars) {
        if (mapaVar2Lead[v]) { leadId = mapaVar2Lead[v]; break }
      }

      if (!leadId) {
        // Lead não existe: cria com telefone normalizado (5511...)
        const { data: novoLead } = await db
          .from('leads')
          .upsert(
            {
              nome,
              email: `${c.normalizado}@disparo.local`,
              whatsapp: c.normalizado,
              origem: listaNome,
              etiqueta: 'ia_atendendo',
              status_lead: 'frio',
            },
            { onConflict: 'whatsapp', ignoreDuplicates: false }
          )
          .select('id')
          .single()
        leadId = novoLead?.id ?? null
        // Atualiza mapa para próximas iterações da mesma lista
        if (leadId) {
          for (const v of c.vars) mapaVar2Lead[v] = leadId
        }
      }

      // Vincula lead_id ao contato (permite busca reversa no webhook Baileys)
      if (leadId) {
        await db.from('wpp_contatos').update({ lead_id: leadId }).eq('id', c.id)
      }
    }
  } catch (err) {
    console.error('[disparo] Erro ao sincronizar leads:', err)
  }
}

// Salva as mensagens disparadas no histórico de conversa dos leads correspondentes.
// Usa variações de telefone para encontrar o lead mesmo quando o formato difere
// (ex: lead tem "11999999999" mas disparo usou "5511999999999").
async function salvarDisparoNaConversa(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  enviados: Array<{ phone: string; mensagem: string }>
): Promise<void> {
  if (!enviados.length) return
  try {
    // Gera todas as variações de telefone para busca abrangente
    const todasVars = [...new Set(enviados.flatMap(e => variacoesTelefone(e.phone)))]

    const { data: leads } = await db
      .from('leads')
      .select('id, whatsapp')
      .in('whatsapp', todasVars)

    if (!leads?.length) return

    // Mapa bidirecional: qualquer variação do whatsapp do lead → lead_id
    const mapaVar2Lead: Record<string, string> = {}
    for (const l of leads as Array<{ id: string; whatsapp: string }>) {
      for (const v of variacoesTelefone(l.whatsapp)) {
        mapaVar2Lead[v] = l.id
      }
    }

    const inserts = enviados
      .map(e => {
        // Tenta cada variação do phone enviado até achar um lead
        const vars = variacoesTelefone(e.phone)
        const leadId = vars.map(v => mapaVar2Lead[v]).find(Boolean)
        return leadId ? { lead_id: leadId, role: 'assistant', mensagem: e.mensagem } : null
      })
      .filter((x): x is { lead_id: string; role: string; mensagem: string } => x !== null)

    if (inserts.length > 0) {
      await db.from('conversas').insert(inserts)
    }
  } catch (err) {
    console.error('[disparo] Erro ao salvar conversa:', err)
  }
}

// POST — dispara sequência de mensagens para contatos filtrados de uma lista
// body: { lista_id, mensagens: MensagemItem[], filtros?: Filtros, api_provider?: 'meta' | 'zapi' }
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const lista_id: string = payload.lista_id
    const filtros: Filtros = payload.filtros ?? {}
    const apiProvider: 'meta' | 'zapi' | 'baileys' = ['zapi', 'baileys'].includes(payload.api_provider)
      ? payload.api_provider
      : 'meta'
    const baileysInstanceId: string = payload.baileys_instance_id || '1'
    const metaInstanciaId: string | null = payload.meta_instancia_id || null

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

    // Credenciais conforme provedor escolhido
    let phoneNumberId: string | null = null
    let accessToken: string | null = null
    let zapiInstanceId: string | null = null
    let zapiToken: string | null = null
    let zapiClientToken: string | null = null

    let baileysApiUrl: string | null = null

    if (apiProvider === 'zapi') {
      zapiInstanceId = await getConfig('ZAPI_INSTANCE_ID')
      zapiToken = await getConfig('ZAPI_TOKEN')
      zapiClientToken = await getConfig('ZAPI_CLIENT_TOKEN')
      if (!zapiInstanceId || !zapiToken) {
        return NextResponse.json({ error: 'ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurados nas Integrações' }, { status: 500 })
      }
    } else if (apiProvider === 'baileys') {
      baileysApiUrl = await getConfig('BAILEYS_API_URL')
      if (!baileysApiUrl) {
        return NextResponse.json({ error: 'BAILEYS_API_URL não configurada nas Integrações. Inicie o servidor local e configure a URL.' }, { status: 500 })
      }
    } else {
      // Se foi passada uma instância específica, usa as credenciais dela
      if (metaInstanciaId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inst } = await (createAdminClient() as any)
          .from('whatsapp_instancias')
          .select('meta_phone_number_id, meta_access_token, label')
          .eq('id', metaInstanciaId)
          .eq('tipo', 'meta')
          .single()
        if (inst?.meta_phone_number_id && inst?.meta_access_token) {
          phoneNumberId = inst.meta_phone_number_id
          accessToken = inst.meta_access_token
        }
      }
      // Fallback para env vars se não encontrou instância
      if (!phoneNumberId) phoneNumberId = await getConfig('META_PHONE_NUMBER_ID')
      if (!accessToken) accessToken = await getConfig('META_ACCESS_TOKEN')
      if (!phoneNumberId || !accessToken) {
        return NextResponse.json({ error: 'META_PHONE_NUMBER_ID ou META_ACCESS_TOKEN não configurados' }, { status: 500 })
      }
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

    // Sincroniza todos os contatos da lista como leads (upsert silencioso)
    void sincronizarContatosComoLeads(db, lista_id, listaInfo?.nome ?? '')

    // Busca template padrão para contatos fora da janela 24h
    const templatePadrao = await getConfig('META_TEMPLATE_NAME')

    // ── Busca contatos com dados necessários para filtros e janela 24h ──
    let contatosFiltrados: Array<{
      id: string
      nome: string | null
      telefone: string
      dentro_24h: boolean
      lead_id?: string
      pilar_fraco?: string | null
      qs_total?: number | null
    }>

    const agora = Date.now()
    const VINTE_QUATRO_H = 24 * 60 * 60 * 1000

    if (isLeads) {
      // Busca com join de leads (mesma lógica do GET contatos)
      const { data: contatos, error: contatosErr } = await db
        .from('wpp_contatos')
        .select('id, nome, telefone, criado_em, ultima_msg_user, lead_id, leads:lead_id(id, pilar_fraco, nivel_qs, status_lead, renda_mensal, qs_total)')
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
      type ContatoLead = { id: string; nome: string | null; telefone: string; dentro_24h: boolean; lead_id?: string; pilar_fraco: string | null; nivel_qs: string | null; status_lead: string | null; renda_mensal: string | null; qs_total: number | null }
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
          qs_total: lead?.qs_total as number | null ?? null,
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

    // ── Baileys: envia lista ao servidor local e retorna jobId para polling ──
    if (apiProvider === 'baileys') {
      // Monta lista personalizada por contato (Vercel faz a personalização, Baileys só envia)
      const listaParaBaileys = contatosFiltrados.map(contato => ({
        phone: contato.telefone,
        mensagens: mensagens
          .filter(m => m.tipo !== 'template')
          .map(msg => {
            if (msg.tipo === 'text') {
              return { type: 'text', content: substituirVariaveis(sortearTexto(msg), contato as Record<string, unknown>) }
            }
            return {
              type: msg.tipo,
              content: msg.conteudo,
              caption: msg.caption ? substituirVariaveis(msg.caption, contato as Record<string, unknown>) : undefined,
              filename: msg.filename,
            }
          }),
      }))

      const base = baileysApiUrl!.replace(/\/$/, '')
      const baileysRes = await fetch(`${base}/disparar-lista`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: baileysInstanceId, contatos: listaParaBaileys }),
        signal: AbortSignal.timeout(10000),
      })

      if (!baileysRes.ok) {
        const err = await baileysRes.json().catch(() => ({}))
        return NextResponse.json({ error: err.error || 'Erro ao iniciar disparo no servidor Baileys' }, { status: 502 })
      }

      const { jobId } = await baileysRes.json()

      // Salva primeiro texto de cada contato no histórico de conversa do lead
      void salvarDisparoNaConversa(
        db,
        listaParaBaileys.map(c => ({
          phone: normalizarTelefone(c.phone),
          mensagem: c.mensagens[0]
            ? (c.mensagens[0].type === 'text' ? String(c.mensagens[0].content ?? '') : `[${c.mensagens[0].type}]`)
            : '[disparo]',
        }))
      )

      // Registra disparo no Supabase (totais serão 0 — atualizados quando o job concluir)
      const resumoBaileys = mensagens.map(m => m.tipo).join(' + ')
      await db.from('wpp_disparos').insert({
        lista_id,
        lista_nome: listaInfo?.nome ?? '',
        tipo: mensagens.length === 1 ? mensagens[0].tipo : 'sequence',
        conteudo: resumoBaileys,
        caption: null,
        filename: null,
        total: contatosFiltrados.length,
        enviados: 0,
        falhas: 0,
      })

      return NextResponse.json({ ok: true, jobId, total: contatosFiltrados.length, provider: 'baileys' })
    }

    // ── Meta / Z-API: processa no Vercel (sem timeout para listas razoáveis) ──
    let enviados = 0
    let falhas = 0
    const erros: string[] = []
    const registrosConversa: Array<{ phone: string; mensagem: string }> = []

    for (const contato of contatosFiltrados) {
      let contatoOk = true
      let primeiroTextoEnviado: string | null = null

      if (apiProvider === 'zapi') {
        for (const msg of mensagens) {
          if (msg.tipo === 'template') continue
          const msgPersonalizada: MensagemItem = msg.tipo === 'text'
            ? { ...msg, conteudo: substituirVariaveis(sortearTexto(msg), contato as Record<string, unknown>) }
            : msg.caption
              ? { ...msg, caption: substituirVariaveis(msg.caption, contato as Record<string, unknown>) }
              : msg
          try {
            await enviarZApi(zapiInstanceId!, zapiToken!, zapiClientToken, contato.telefone, msgPersonalizada)
            if (!primeiroTextoEnviado) {
              primeiroTextoEnviado = msg.tipo === 'text'
                ? (msgPersonalizada.conteudo ?? '')
                : `[${msg.tipo}]`
            }
          } catch (err) {
            contatoOk = false
            erros.push(`${contato.telefone}: ${err instanceof Error ? err.message : String(err)}`)
            break
          }
          if (mensagens.length > 1) await new Promise(r => setTimeout(r, 200 + Math.random() * 200))
        }
      } else {
        // ── Meta API: respeita janela 24h ──
        if (contato.dentro_24h) {
          for (const msg of mensagens) {
            let msgFinal: MensagemItem
            if (msg.tipo === 'template') {
              msgFinal = preencherVarsTemplate(msg, contato as Record<string, unknown>)
            } else if (msg.tipo === 'text') {
              msgFinal = { ...msg, conteudo: substituirVariaveis(sortearTexto(msg), contato as Record<string, unknown>) }
            } else if (msg.caption) {
              msgFinal = { ...msg, caption: substituirVariaveis(msg.caption, contato as Record<string, unknown>) }
            } else {
              msgFinal = msg
            }
            try {
              await enviarMeta(phoneNumberId!, accessToken!, contato.telefone, msgFinal)
              if (!primeiroTextoEnviado) {
                primeiroTextoEnviado = msg.tipo === 'text'
                  ? (msgFinal.conteudo ?? '')
                  : msg.tipo === 'template'
                    ? `[template: ${msg.template_name}]`
                    : `[${msg.tipo}]`
              }
            } catch (err) {
              contatoOk = false
              erros.push(`${contato.telefone}: ${err instanceof Error ? err.message : String(err)}`)
              break
            }
            if (mensagens.length > 1) await new Promise(r => setTimeout(r, 200 + Math.random() * 200))
          }
        } else {
          const templatesDaFila = mensagens.filter(m => m.tipo === 'template')
          if (templatesDaFila.length > 0) {
            for (const msg of templatesDaFila) {
              const msgComVars = preencherVarsTemplate(msg, contato)
              try {
                await enviarMeta(phoneNumberId!, accessToken!, contato.telefone, msgComVars)
                if (!primeiroTextoEnviado) primeiroTextoEnviado = `[template: ${msg.template_name}]`
              } catch (err) {
                contatoOk = false
                erros.push(`${contato.telefone}: ${err instanceof Error ? err.message : String(err)}`)
                break
              }
              if (templatesDaFila.length > 1) await new Promise(r => setTimeout(r, 200))
            }
          } else if (templatePadrao) {
            const c = contato as Record<string, unknown>
            // Usa template_param_count do config para não enviar params errados.
            // Se META_TEMPLATE_PARAM_COUNT não estiver definido, envia sem vars
            // (templates sem parâmetros funcionam; com params o user precisa configurar a contagem)
            const paramCountStr = await getConfig('META_TEMPLATE_PARAM_COUNT')
            const paramCount = paramCountStr ? parseInt(paramCountStr, 10) : 0
            const pool = [(contato.nome || 'Lead') as string, String(c.qs_total ?? 0), (c.pilar_fraco as string) || 'N/A']
            const fallbackVars = paramCount > 0 ? pool.slice(0, Math.min(paramCount, pool.length)) : []
            try {
              await enviarMeta(phoneNumberId!, accessToken!, contato.telefone, {
                tipo: 'template',
                template_name: templatePadrao,
                template_lang: 'pt_BR',
                template_vars: fallbackVars,
              })
              if (!primeiroTextoEnviado) primeiroTextoEnviado = `[template: ${templatePadrao}]`
            } catch (err) {
              contatoOk = false
              erros.push(`${contato.telefone} (template): ${err instanceof Error ? err.message : String(err)}`)
            }
          } else {
            contatoOk = false
            erros.push(`${contato.telefone}: fora da janela 24h e nenhum template configurado.`)
          }
        }
      }

      if (contatoOk) {
        enviados++
        if (primeiroTextoEnviado) {
          registrosConversa.push({ phone: normalizarTelefone(contato.telefone), mensagem: primeiroTextoEnviado })
        }
      } else falhas++
      await new Promise(r => setTimeout(r, 300))
    }

    // Salva mensagens enviadas no histórico de conversa dos leads
    void salvarDisparoNaConversa(db, registrosConversa)

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

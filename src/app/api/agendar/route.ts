import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarViaBaileys } from '@/lib/baileys'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

function buildOAuth2(refreshToken: string) {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return oauth2
}

async function criarEventoCalendar(
  refreshToken: string,
  summary: string,
  dataHoraInicio: string,
  dataHoraFim: string,
  attendeeEmail: string | null,
): Promise<{ eventLink: string; meetLink: string | null }> {
  const auth = buildOAuth2(refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })

  const event = {
    summary,
    start: { dateTime: dataHoraInicio, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: dataHoraFim, timeZone: 'America/Sao_Paulo' },
    conferenceData: {
      createRequest: { requestId: `maestria-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
    },
    attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
  }

  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    conferenceDataVersion: 1,
    sendUpdates: attendeeEmail ? 'all' : 'none',
  })

  const data = res.data
  const meetLink = data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ?? null
  return { eventLink: data.htmlLink ?? '', meetLink }
}


/**
 * Descobre automaticamente qual instância Baileys usar para mandar a confirmação.
 *
 * Ordem de prioridade:
 * 1. Agente que já conversou com esse telefone (via conversas.agente_id → agentes.canais)
 * 2. Primeira instância Baileys conectada no servidor
 * 3. null (pula o envio)
 */
async function descobrirInstanciaBaileys(telefone: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Variações do telefone (com e sem código de país, 9 dígito, etc.)
  const tel = telefone.replace(/\D/g, '')
  const variacoes = Array.from(new Set([
    tel,
    tel.startsWith('55') ? tel.slice(2) : `55${tel}`,
    tel.length === 11 ? `55${tel}` : tel,
    tel.length === 13 && tel.startsWith('55') ? tel.slice(2) : tel,
    // com 9 extra
    tel.length === 12 && tel.startsWith('55') ? `${tel.slice(0, 4)}9${tel.slice(4)}` : tel,
    // sem 9 extra
    tel.length === 13 && tel.startsWith('55') && tel[4] === '9' ? `${tel.slice(0, 4)}${tel.slice(5)}` : tel,
  ]))

  // 1. Achar lead pelo telefone em wpp_contatos
  const { data: contatos } = await admin
    .from('wpp_contatos')
    .select('lead_id')
    .in('telefone', variacoes)
    .not('lead_id', 'is', null)
    .limit(1)

  const leadId: string | null = contatos?.[0]?.lead_id ?? null

  if (leadId) {
    // 2. Pegar conversa mais recente com agente_id preenchido
    const { data: conversa } = await admin
      .from('conversas')
      .select('agente_id')
      .eq('lead_id', leadId)
      .not('agente_id', 'is', null)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single()

    if (conversa?.agente_id) {
      // 3. Pegar canais do agente → achar Baileys
      const { data: agente } = await admin
        .from('agentes')
        .select('canais')
        .eq('id', conversa.agente_id)
        .single()

      const canais: Array<{ provider: string; id: string }> = agente?.canais ?? []
      const baileysCan = canais.find(c => c.provider === 'baileys')
      if (baileysCan?.id) return baileysCan.id
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { pessoaId, data, horario, duracao, campos } = body

  if (!pessoaId || !data || !horario || !duracao) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: pessoa, error: pErr } = await admin
    .from('agenda_pessoas')
    .select('id, nome, google_refresh_token, agente_id')
    .eq('id', pessoaId)
    .single()
  if (pErr || !pessoa) return NextResponse.json({ error: 'Pessoa não encontrada' }, { status: 404 })

  // Montar datas locais para o Google Calendar (sem conversão UTC)
  const [hh, mm] = horario.split(':').map(Number)
  const totalMin = hh * 60 + mm + duracao
  const horaFimStr = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
  // Strings locais — o campo timeZone: 'America/Sao_Paulo' no evento garante a interpretação correta
  const isoInicio = `${data}T${horario}:00`
  const isoFim = `${data}T${horaFimStr}:00`

  // Extrair dados do lead dos campos preenchidos (busca case-insensitive por chave)
  function extrairCampo(obj: Record<string, string>, ...chaves: string[]): string | null {
    if (!obj) return null
    for (const chave of chaves) {
      const match = Object.entries(obj).find(([k]) => k.toLowerCase().includes(chave.toLowerCase()))
      if (match?.[1]) return match[1]
    }
    return null
  }
  const nomeCliente: string = extrairCampo(campos, 'nome') ?? 'Cliente'
  const emailCliente: string | null = extrairCampo(campos, 'e-mail', 'email')
  const whatsCliente: string | null = extrairCampo(campos, 'whatsapp', 'whats', 'telefone', 'celular')

  // Criar evento no Google Calendar (se tiver token configurado)
  let meetLink: string | null = null
  let googleEventLink: string | null = null
  if (pessoa.google_refresh_token) {
    try {
      const result = await criarEventoCalendar(
        pessoa.google_refresh_token,
        `${nomeCliente} — Sessão com ${pessoa.nome}`,
        isoInicio,
        isoFim,
        emailCliente,
      )
      meetLink = result.meetLink
      googleEventLink = result.eventLink
    } catch (e) {
      console.error('Erro ao criar evento Google Calendar:', e)
    }
  }

  // Salvar agendamento
  const { data: agendamento, error: aErr } = await admin
    .from('agenda_agendamentos')
    .insert({
      pessoa_id: pessoaId,
      data,
      horario,
      horario_fim: horaFimStr,
      nome_lead: nomeCliente,
      email_lead: emailCliente ?? '',
      whatsapp_lead: whatsCliente,
      campos_extras: campos ?? {},
      campos_preenchidos: campos ?? {},
      meet_link: meetLink,
      google_event_link: googleEventLink,
      status: 'confirmado',
    })
    .select()
    .single()

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  // Bloquear o slot agendado para que não apareça disponível para outros leads
  await admin.from('agenda_excecoes').insert({
    pessoa_id: pessoaId,
    data,
    tipo: 'bloqueado',
    inicio: horario,
    fim: horaFimStr,
  })

  // Enviar WhatsApp de confirmação para o lead
  if (whatsCliente) {
    // Prioridade 1: agente vinculado diretamente à pessoa da agenda
    let instanciaId: string | null = null
    if (pessoa.agente_id) {
      const { data: agente } = await admin
        .from('agentes')
        .select('canais')
        .eq('id', pessoa.agente_id)
        .single()
      const canais: Array<{ provider: string; id: string }> = agente?.canais ?? []
      instanciaId = canais.find((c: { provider: string; id: string }) => c.provider === 'baileys')?.id ?? null
    }

    // Prioridade 2: histórico de conversa do lead (fallback para leads do disparo)
    if (!instanciaId) {
      instanciaId = await descobrirInstanciaBaileys(whatsCliente)
    }

    if (instanciaId) {
      const dataFormatada = new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
      let mensagem = `Olá, ${nomeCliente}! ✅ Seu agendamento com *${pessoa.nome}* está confirmado!\n\n📅 *${dataFormatada}* às *${horario}*\n⏱ Duração: ${duracao} minutos`
      if (meetLink) mensagem += `\n\n🎥 Link da reunião:\n${meetLink}`
      mensagem += '\n\nAté lá! 😊'
      try {
        await enviarViaBaileys(whatsCliente, mensagem, instanciaId)
      } catch (err) {
        console.warn('[agendar] Falha ao enviar confirmação WhatsApp:', err)
      }
    } else {
      console.warn('[agendar] Nenhuma instância Baileys disponível para enviar confirmação. whatsapp:', whatsCliente)
    }
  }

  return NextResponse.json({ ok: true, agendamento }, { status: 201 })
}

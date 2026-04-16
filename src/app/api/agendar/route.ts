import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const BAILEYS_SERVER_URL = process.env.BAILEYS_SERVER_URL ?? 'http://localhost:3001'

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

async function enviarWhatsApp(numero: string, texto: string, sessaoId: string) {
  try {
    await fetch(`${BAILEYS_SERVER_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessaoId, number: numero, message: texto }),
    })
  } catch {
    // WhatsApp não é crítico — não falha o agendamento
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { pessoaId, data, horario, duracao, campos } = body

  if (!pessoaId || !data || !horario || !duracao) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Carregar pessoa
  const { data: pessoa, error: pErr } = await admin
    .from('agenda_pessoas')
    .select('id, nome, google_refresh_token')
    .eq('id', pessoaId)
    .single()
  if (pErr || !pessoa) return NextResponse.json({ error: 'Pessoa não encontrada' }, { status: 404 })

  // Montar datas ISO
  const [horaInicio, minInicio] = horario.split(':').map(Number)
  const dtInicio = new Date(`${data}T${horario}:00`)
  const dtFim = new Date(dtInicio.getTime() + duracao * 60 * 1000)

  const isoInicio = dtInicio.toISOString()
  const isoFim = dtFim.toISOString()

  const horaFimStr = `${String(dtFim.getHours()).padStart(2, '0')}:${String(dtFim.getMinutes()).padStart(2, '0')}`
  void horaInicio; void minInicio

  // Dados do lead
  const nomeCliente: string = campos?.['nome'] ?? campos?.['Nome'] ?? 'Cliente'
  const emailCliente: string | null = campos?.['email'] ?? campos?.['E-mail'] ?? campos?.['email'] ?? null
  const whatsCliente: string | null = campos?.['whatsapp'] ?? campos?.['WhatsApp'] ?? null

  // Criar evento no Google Calendar (se tiver token)
  let meetLink: string | null = null
  let eventLink: string | null = null
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
      eventLink = result.eventLink
    } catch (e) {
      console.error('Erro ao criar evento Google Calendar:', e)
      // não bloquear o agendamento
    }
  }

  // Salvar agendamento
  const { data: agendamento, error: aErr } = await admin
    .from('agenda_agendamentos')
    .insert({
      pessoa_id: pessoaId,
      data,
      horario_inicio: horario,
      horario_fim: horaFimStr,
      campos_preenchidos: campos ?? {},
      google_event_link: eventLink,
      meet_link: meetLink,
      status: 'confirmado',
    })
    .select()
    .single()

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  // Enviar WhatsApp de confirmação (se tiver número do cliente e sessão Baileys configurada)
  const sessaoBaileysPadrao = process.env.BAILEYS_SESSAO_ID
  if (whatsCliente && sessaoBaileysPadrao) {
    const dataFormatada = new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
    let mensagem = `Olá, ${nomeCliente}! ✅ Seu agendamento com *${pessoa.nome}* está confirmado!\n\n📅 *${dataFormatada}* às *${horario}*\n⏱ Duração: ${duracao} minutos`
    if (meetLink) mensagem += `\n\n🎥 Link da reunião:\n${meetLink}`
    mensagem += '\n\nAté lá! 😊'
    await enviarWhatsApp(whatsCliente, mensagem, sessaoBaileysPadrao)
  }

  return NextResponse.json({ ok: true, agendamento }, { status: 201 })
}

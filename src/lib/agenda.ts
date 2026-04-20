import { createAdminClient } from './supabase/admin'
import { google } from 'googleapis'
import { enviarViaBaileys } from './baileys'
import { enviarMensagemWhatsApp } from './meta'

// ── Helpers de slot ────────────────────────────────────────────────────────────

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

type Horario = { dia_semana: number; inicio: string; fim: string; ativo: boolean }
type Excecao = { data: string; tipo: 'bloqueado' | 'extra'; inicio: string | null; fim: string | null }

function gerarSlotsDia(data: Date, horarios: Horario[], excecoes: Excecao[], duracao: number): string[] {
  const dataStr = toDateStr(data)
  const diaSemana = data.getDay()

  if (excecoes.some(e => e.data === dataStr && e.tipo === 'bloqueado' && !e.inicio)) return []

  const periodos: { inicio: string; fim: string }[] = []
  horarios.filter(h => h.dia_semana === diaSemana && h.ativo)
    .forEach(h => periodos.push({ inicio: h.inicio.slice(0, 5), fim: h.fim.slice(0, 5) }))
  excecoes.filter(e => e.data === dataStr && e.tipo === 'extra' && e.inicio && e.fim)
    .forEach(e => periodos.push({ inicio: e.inicio!.slice(0, 5), fim: e.fim!.slice(0, 5) }))

  const bloqueados = new Set(
    excecoes.filter(e => e.data === dataStr && e.tipo === 'bloqueado' && e.inicio).map(e => e.inicio!.slice(0, 5))
  )

  const slots: string[] = []
  for (const p of periodos) {
    let atual = p.inicio
    while (addMinutes(atual, duracao) <= p.fim) {
      if (!bloqueados.has(atual)) slots.push(atual)
      atual = addMinutes(atual, duracao)
    }
  }
  return slots.sort()
}

function toDateStr(d: Date): string {
  // Usa horário de São Paulo para evitar bug de fuso UTC→local
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

// Filtra slots para criar escassez artificial: máx 3 por dia, distribuídos no horário
function filtrarEscassez(slots: string[], max = 3): string[] {
  if (slots.length <= max) return slots
  const manha = slots.filter(s => parseInt(s) < 12)
  const tarde  = slots.filter(s => parseInt(s) >= 12)
  const pick: string[] = []
  if (manha.length) pick.push(manha[Math.floor(manha.length / 2)])
  if (tarde.length)  pick.push(tarde[Math.floor(tarde.length / 2)])
  // Terceiro slot aleatório do meio do dia se ainda couber
  if (pick.length < max) {
    const resto = slots.filter(s => !pick.includes(s))
    if (resto.length) pick.push(resto[Math.floor(resto.length / 2)])
  }
  return pick.slice(0, max).sort()
}

// ── Busca slots com escassez ─────────────────────────────────────────────────

export interface DiaDisponivel {
  data: string         // YYYY-MM-DD
  dataFormatada: string
  slots: string[]      // horários escolhidos (máx 3)
}

export async function buscarSlotsComEscassez(
  pessoaId: string,
  opts?: { maxDias?: number; maxSlots?: number },
): Promise<DiaDisponivel[]> {
  const maxDias  = Math.max(1, Math.min(opts?.maxDias  ?? 2, 14))
  const maxSlots = Math.max(1, Math.min(opts?.maxSlots ?? 3,  8))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const [pessoaRes, horariosRes, excecoesRes, agendamentosRes] = await Promise.all([
    admin.from('agenda_pessoas').select('duracao_slot').eq('id', pessoaId).single(),
    admin.from('agenda_horarios').select('*').eq('pessoa_id', pessoaId),
    admin.from('agenda_excecoes').select('*').eq('pessoa_id', pessoaId),
    admin.from('agenda_agendamentos').select('data, horario').eq('pessoa_id', pessoaId).eq('status', 'confirmado'),
  ])

  const duracao: number = pessoaRes.data?.duracao_slot ?? 60
  const horarios: Horario[] = horariosRes.data ?? []
  const excecoes: Excecao[] = excecoesRes.data ?? []

  // Agendamentos confirmados viram exceções bloqueadas
  const excComAgend: Excecao[] = [...excecoes]
  for (const ag of agendamentosRes.data ?? []) {
    excComAgend.push({ data: ag.data, tipo: 'bloqueado', inicio: ag.horario, fim: null })
  }

  const agora = new Date()
  agora.setHours(agora.getHours(), agora.getMinutes(), 0, 0)
  const diasComSlots: DiaDisponivel[] = []

  for (let i = 1; i <= 21 && diasComSlots.length < maxDias; i++) {
    const dia = new Date()
    dia.setDate(new Date().getDate() + i)
    dia.setHours(0, 0, 0, 0)

    let slots = gerarSlotsDia(dia, horarios, excComAgend, duracao)
    // Remove slots que já passaram hoje
    const isHoje = toDateStr(dia) === toDateStr(new Date())
    if (isHoje) {
      const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
      slots = slots.filter(s => s > horaAtual)
    }
    if (slots.length === 0) continue

    diasComSlots.push({
      data: toDateStr(dia),
      dataFormatada: dia.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }),
      slots: filtrarEscassez(slots, maxSlots),
    })
  }

  return diasComSlots.slice(0, maxDias)
}

// Formata os slots disponíveis como texto para o agente
export function formatarSlotsParaAgente(dias: DiaDisponivel[]): string {
  if (dias.length === 0) return 'Não há horários disponíveis nos próximos dias.'
  return dias.map(d => {
    const horas = d.slots.map(s => `*${s}*`).join(' ou ')
    return `• *${d.dataFormatada}* — ${horas}`
  }).join('\n')
}

// ── Criar agendamento ─────────────────────────────────────────────────────────

function buildOAuth2(refreshToken: string) {
  const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return oauth2
}

async function criarMeet(
  refreshToken: string, summary: string, isoInicio: string, isoFim: string, attendeeEmail: string | null
): Promise<string | null> {
  try {
    const calendar = google.calendar({ version: 'v3', auth: buildOAuth2(refreshToken) })
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        start: { dateTime: isoInicio, timeZone: 'America/Sao_Paulo' },
        end:   { dateTime: isoFim,   timeZone: 'America/Sao_Paulo' },
        conferenceData: { createRequest: { requestId: `agente-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
      },
      conferenceDataVersion: 1,
      sendUpdates: attendeeEmail ? 'all' : 'none',
    })
    return res.data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ?? null
  } catch (e) {
    console.error('[agenda] Erro Google Calendar:', e)
    return null
  }
}

export interface AgendarParams {
  pessoaId: string
  data: string       // YYYY-MM-DD
  horario: string    // HH:MM
  nomeCliente: string
  emailCliente: string
  whatsCliente: string
  leadId: string
  agenteId?: string | null
  canalProvider?: 'meta' | 'baileys'
  canalInstanciaId?: string
}

export async function agendarParaLead(p: AgendarParams): Promise<{ meetLink: string | null; mensagem: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: pessoa } = await admin
    .from('agenda_pessoas')
    .select('id, nome, google_refresh_token, duracao_slot')
    .eq('id', p.pessoaId).single()
  if (!pessoa) throw new Error('Pessoa da agenda não encontrada')

  const duracao: number = pessoa.duracao_slot ?? 60
  const [hh, mm] = p.horario.split(':').map(Number)
  const totalMin = hh * 60 + mm + duracao
  const horaFim = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`

  const meetLink = pessoa.google_refresh_token
    ? await criarMeet(
        pessoa.google_refresh_token,
        `${p.nomeCliente} — Sessão com ${pessoa.nome}`,
        `${p.data}T${p.horario}:00`, `${p.data}T${horaFim}:00`,
        p.emailCliente || null,
      )
    : null

  // Salvar agendamento (sequencial para detectar erros individualmente)
  const camposBase = { nome: p.nomeCliente, email: p.emailCliente, whatsapp: p.whatsCliente }
  const { error: errAg } = await admin.from('agenda_agendamentos').insert({
    pessoa_id: p.pessoaId, data: p.data, horario: p.horario, horario_fim: horaFim,
    nome_lead: p.nomeCliente, email_lead: p.emailCliente, whatsapp_lead: p.whatsCliente,
    campos_preenchidos: camposBase,
    campos_extras: camposBase,
    meet_link: meetLink, status: 'confirmado',
  })
  if (errAg) {
    console.error('[agendarParaLead] agenda_agendamentos insert:', errAg)
    throw new Error(`Falha ao salvar agendamento: ${errAg.message}`)
  }

  // Bloquear slot nas exceções
  const { error: errExc } = await admin.from('agenda_excecoes').insert({
    pessoa_id: p.pessoaId, data: p.data, tipo: 'bloqueado', inicio: p.horario, fim: horaFim,
  })
  if (errExc) {
    // Excecao duplicada não é crítica (slot já pode estar bloqueado por outro caminho)
    console.warn('[agendarParaLead] agenda_excecoes insert (não crítico):', errExc.message)
  }

  await admin.from('leads').update({ etiqueta: 'agendado', pipeline_etapa: 'agendado' }).eq('id', p.leadId)

  const dataFormatada = new Date(`${p.data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  let msg = `✅ Agendado!\n\n📅 *${dataFormatada}* às *${p.horario}*\n⏱ ${duracao} minutos`
  if (meetLink) msg += `\n\n🎥 Link Google Meet:\n${meetLink}`
  msg += '\n\nAté lá! 😊'

  // Enviar WhatsApp de confirmação
  if (p.whatsCliente) {
    try {
      if (p.canalProvider === 'baileys' && p.canalInstanciaId) {
        await enviarViaBaileys(p.whatsCliente, msg, p.canalInstanciaId)
      } else {
        await enviarMensagemWhatsApp(p.whatsCliente, msg)
      }
    } catch (e) {
      console.error('[agenda] Falha confirmação WhatsApp:', e)
    }

    await admin.from('conversas').insert({
      lead_id: p.leadId, role: 'assistant', mensagem: msg, agente_id: p.agenteId ?? null,
    })
  }

  return { meetLink, mensagem: msg }
}

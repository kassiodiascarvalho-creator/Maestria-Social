"use client"

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Pessoa = { id: string; nome: string; role: string; foto_url?: string | null }
type Agendamento = {
  id: string
  pessoa_id: string
  data: string
  horario: string
  horario_fim: string | null
  nome_lead: string
  email_lead: string | null
  whatsapp_lead: string | null
  campos_preenchidos: Record<string, string> | null
  meet_link: string | null
  status: string
  criado_em: string
  agenda_pessoas: Pessoa | null
}

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const HORA_INICIO = 6
const HORA_FIM = 20
const PX_POR_HORA = 64

const CORES_PESSOA = [
  '#4F8EF7', '#F7B84F', '#6ACF7E', '#F74F8E', '#AF4FF7',
  '#F7E84F', '#4FF7E8', '#F77A4F', '#4F6AF7', '#CF4FF7',
]

function corDaPessoa(pessoaId: string, pessoas: Pessoa[]): string {
  const idx = pessoas.findIndex(p => p.id === pessoaId)
  return CORES_PESSOA[(idx < 0 ? 0 : idx) % CORES_PESSOA.length]
}

function minutosParaPx(minutos: number): number {
  return (minutos - HORA_INICIO * 60) / 60 * PX_POR_HORA
}

function horarioParaMinutos(h: string): number {
  const [hh, mm] = h.slice(0, 5).split(':').map(Number)
  return hh * 60 + mm
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function semanaStr(segunda: Date): string {
  const domingo = new Date(segunda)
  domingo.setDate(segunda.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${segunda.toLocaleDateString('pt-BR', opts)} – ${domingo.toLocaleDateString('pt-BR', opts)}`
}

const STATUS_CONFIG: Record<string, { label: string; cor: string }> = {
  confirmado: { label: 'Confirmado', cor: '#4F8EF7' },
  iniciado:   { label: 'Em andamento', cor: '#F7B84F' },
  realizado:  { label: 'Realizado', cor: '#6ACF7E' },
  cancelado:  { label: 'Cancelado', cor: '#e05840' },
  no_show:    { label: 'No-show', cor: '#7a6e5e' },
}

export default function CalendarioView({ agendamentosIniciais, pessoas, semanaInicialStr }: {
  agendamentosIniciais: Agendamento[]
  pessoas: Pessoa[]
  semanaInicialStr: string
}) {
  const router = useRouter()
  const [segunda, setSegunda] = useState<Date>(() => new Date(semanaInicialStr + 'T12:00:00'))
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(agendamentosIniciais)
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [atualizandoStatus, setAtualizandoStatus] = useState(false)

  const hoje = fmtDate(new Date())

  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(segunda)
    d.setDate(segunda.getDate() + i)
    return d
  })

  const carregarSemana = useCallback(async (seg: Date) => {
    setCarregando(true)
    const dom = new Date(seg)
    dom.setDate(seg.getDate() + 6)
    const res = await fetch(`/api/admin/agenda/agendamentos?inicio=${fmtDate(seg)}&fim=${fmtDate(dom)}`)
    if (res.ok) setAgendamentos(await res.json())
    setCarregando(false)
  }, [])

  function navegar(delta: number) {
    const nova = new Date(segunda)
    nova.setDate(segunda.getDate() + delta * 7)
    setSegunda(nova)
    carregarSemana(nova)
  }

  function irParaHoje() {
    const agora = new Date()
    const dia = agora.getDay()
    const seg = new Date(agora)
    seg.setDate(agora.getDate() - (dia === 0 ? 6 : dia - 1))
    seg.setHours(12, 0, 0, 0)
    setSegunda(seg)
    carregarSemana(seg)
  }

  async function atualizarStatus(id: string, status: string) {
    setAtualizandoStatus(true)
    const res = await fetch(`/api/admin/agenda/agendamentos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const atualizado = await res.json() as Agendamento
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, ...atualizado } : a))
      setSelecionado(prev => prev?.id === id ? { ...prev, status } : prev)
    }
    setAtualizandoStatus(false)
  }

  const horas = Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)
  const alturaGrade = (HORA_FIM - HORA_INICIO) * PX_POR_HORA

  return (
    <>
      <style>{css}</style>
      <div className="cal-root">
        {/* Header */}
        <div className="cal-header">
          <div className="cal-header-left">
            <button className="cal-back" onClick={() => router.push('/dashboard/agenda')}>← Agenda</button>
            <h1 className="cal-titulo">Calendário de Agendamentos</h1>
          </div>
          <div className="cal-nav">
            <button className="cal-hoje-btn" onClick={irParaHoje}>Hoje</button>
            <button className="cal-nav-btn" onClick={() => navegar(-1)}>‹</button>
            <span className="cal-semana-label">{semanaStr(segunda)}</span>
            <button className="cal-nav-btn" onClick={() => navegar(1)}>›</button>
          </div>
          {carregando && <span className="cal-loading">Carregando…</span>}
        </div>

        {/* Legenda pessoas */}
        {pessoas.length > 0 && (
          <div className="cal-legenda">
            {pessoas.map((p, i) => (
              <div key={p.id} className="cal-legenda-item">
                <span className="cal-legenda-cor" style={{ background: CORES_PESSOA[i % CORES_PESSOA.length] }} />
                <span className="cal-legenda-nome">{p.nome}</span>
              </div>
            ))}
          </div>
        )}

        {/* Grade */}
        <div className="cal-grade-wrap">
          {/* Cabeçalho dos dias */}
          <div className="cal-grade-header">
            <div className="cal-hora-col-header" />
            {diasDaSemana.map((d, i) => {
              const str = fmtDate(d)
              const eHoje = str === hoje
              return (
                <div key={i} className={`cal-dia-header ${eHoje ? 'dia-hoje' : ''}`}>
                  <span className="cal-dia-semana-nome">{DIAS_SEMANA[i]}</span>
                  <span className={`cal-dia-num ${eHoje ? 'num-hoje' : ''}`}>{d.getDate()}</span>
                </div>
              )
            })}
          </div>

          {/* Corpo da grade */}
          <div className="cal-grade-body">
            {/* Coluna de horas */}
            <div className="cal-hora-col">
              {horas.map(h => (
                <div key={h} className="cal-hora-cell" style={{ height: PX_POR_HORA }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Colunas dos dias */}
            {diasDaSemana.map((d, dIdx) => {
              const str = fmtDate(d)
              const agsNoDia = agendamentos.filter(a => a.data === str)
              return (
                <div key={dIdx} className="cal-dia-col" style={{ height: alturaGrade }}>
                  {/* Linhas de hora */}
                  {horas.map(h => (
                    <div key={h} className="cal-linha-hora" style={{ top: (h - HORA_INICIO) * PX_POR_HORA }} />
                  ))}

                  {/* Agendamentos */}
                  {agsNoDia.map(ag => {
                    const minInicio = horarioParaMinutos(ag.horario)
                    const minFim = ag.horario_fim ? horarioParaMinutos(ag.horario_fim) : minInicio + 30
                    const top = minutosParaPx(minInicio)
                    const height = Math.max((minFim - minInicio) / 60 * PX_POR_HORA, 24)
                    const cor = corDaPessoa(ag.pessoa_id, pessoas)
                    const cancelado = ag.status === 'cancelado' || ag.status === 'no_show'
                    return (
                      <div
                        key={ag.id}
                        className={`cal-ag-card ${cancelado ? 'ag-cancelado' : ''}`}
                        style={{ top, height, borderLeftColor: cor, background: `${cor}18` }}
                        onClick={() => setSelecionado(ag)}
                        title={`${ag.nome_lead} — ${ag.horario.slice(0,5)}`}
                      >
                        <span className="cal-ag-hora">{ag.horario.slice(0, 5)}</span>
                        <span className="cal-ag-nome">{ag.nome_lead}</span>
                        {ag.meet_link && <span className="cal-ag-meet-icon">🎥</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Popup / Modal de detalhes */}
      {selecionado && (
        <div className="modal-backdrop" onClick={() => setSelecionado(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-titulo-wrap">
                <span className="modal-titulo">Detalhes do Agendamento</span>
                <span className="modal-status-badge" style={{ background: STATUS_CONFIG[selecionado.status]?.cor ?? '#7a6e5e' }}>
                  {STATUS_CONFIG[selecionado.status]?.label ?? selecionado.status}
                </span>
              </div>
              <button className="modal-fechar" onClick={() => setSelecionado(null)}>✕</button>
            </div>

            {/* Pessoa */}
            {selecionado.agenda_pessoas && (
              <div className="modal-pessoa">
                <div className="modal-pessoa-avatar" style={{ background: corDaPessoa(selecionado.pessoa_id, pessoas) }}>
                  {selecionado.agenda_pessoas.nome.charAt(0)}
                </div>
                <div>
                  <p className="modal-pessoa-nome">{selecionado.agenda_pessoas.nome}</p>
                  {selecionado.agenda_pessoas.role && <p className="modal-pessoa-role">{selecionado.agenda_pessoas.role}</p>}
                </div>
              </div>
            )}

            {/* Data e hora */}
            <div className="modal-info-row">
              <div className="modal-info-item">
                <span className="modal-info-icon">📅</span>
                <span>{new Date(selecionado.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
              <div className="modal-info-item">
                <span className="modal-info-icon">⏱</span>
                <span>{selecionado.horario.slice(0,5)}{selecionado.horario_fim ? ` – ${selecionado.horario_fim.slice(0,5)}` : ''}</span>
              </div>
            </div>

            {/* Lead */}
            <div className="modal-secao-titulo">Lead</div>
            <div className="modal-lead-info">
              <div className="modal-lead-row">
                <span className="modal-lead-icon">👤</span>
                <span className="modal-lead-nome">{selecionado.nome_lead}</span>
              </div>
              {selecionado.email_lead && (
                <div className="modal-lead-row">
                  <span className="modal-lead-icon">✉</span>
                  <span>{selecionado.email_lead}</span>
                </div>
              )}
              {selecionado.whatsapp_lead && (
                <div className="modal-lead-row">
                  <span className="modal-lead-icon">📱</span>
                  <span>{selecionado.whatsapp_lead}</span>
                </div>
              )}
              {/* Campos extras do formulário */}
              {selecionado.campos_preenchidos && Object.entries(selecionado.campos_preenchidos)
                .filter(([k]) => !['Nome completo', 'nome', 'E-mail', 'email', 'WhatsApp', 'whatsapp'].includes(k))
                .map(([k, v]) => (
                  <div key={k} className="modal-lead-row">
                    <span className="modal-lead-icon">💬</span>
                    <span><strong>{k}:</strong> {v}</span>
                  </div>
                ))
              }
            </div>

            {/* Meet link */}
            {selecionado.meet_link && (
              <a href={selecionado.meet_link} target="_blank" rel="noopener noreferrer" className="modal-meet-btn">
                🎥 Entrar na reunião
              </a>
            )}

            {/* Ações de status */}
            {selecionado.status !== 'cancelado' && selecionado.status !== 'realizado' && (
              <div className="modal-acoes">
                {selecionado.status === 'confirmado' && (
                  <button className="modal-btn btn-iniciar" onClick={() => atualizarStatus(selecionado.id, 'iniciado')} disabled={atualizandoStatus}>
                    ▶ Iniciar
                  </button>
                )}
                {(selecionado.status === 'confirmado' || selecionado.status === 'iniciado') && (
                  <button className="modal-btn btn-finalizar" onClick={() => atualizarStatus(selecionado.id, 'realizado')} disabled={atualizandoStatus}>
                    ✓ Finalizar
                  </button>
                )}
                {selecionado.status === 'confirmado' && (
                  <button className="modal-btn btn-noshow" onClick={() => atualizarStatus(selecionado.id, 'no_show')} disabled={atualizandoStatus}>
                    ✕ No-show
                  </button>
                )}
                <button className="modal-btn btn-cancelar" onClick={() => atualizarStatus(selecionado.id, 'cancelado')} disabled={atualizandoStatus}>
                  🚫 Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const css = `
  .cal-root{padding:24px 32px;max-width:1400px;margin:0 auto;display:flex;flex-direction:column;gap:16px;min-height:100vh;}
  .cal-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
  .cal-header-left{display:flex;align-items:center;gap:16px;}
  .cal-back{background:none;border:none;color:#7a6e5e;font-size:14px;cursor:pointer;font-family:inherit;padding:0;transition:color .15s;white-space:nowrap;}
  .cal-back:hover{color:#c2904d;}
  .cal-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:700;color:#fff9e6;}
  .cal-nav{display:flex;align-items:center;gap:8px;}
  .cal-hoje-btn{background:rgba(194,144,77,.12);border:1px solid rgba(194,144,77,.3);border-radius:8px;padding:6px 14px;font-size:13px;color:#c2904d;cursor:pointer;font-family:inherit;transition:all .15s;}
  .cal-hoje-btn:hover{background:rgba(194,144,77,.2);}
  .cal-nav-btn{background:#1a1410;border:1px solid #2a1f18;border-radius:8px;width:32px;height:32px;color:#7a6e5e;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .cal-nav-btn:hover{border-color:rgba(194,144,77,.4);color:#c2904d;}
  .cal-semana-label{font-size:14px;color:#fff9e6;min-width:160px;text-align:center;}
  .cal-loading{font-size:12px;color:#4a3e30;}

  /* Legenda */
  .cal-legenda{display:flex;gap:16px;flex-wrap:wrap;}
  .cal-legenda-item{display:flex;align-items:center;gap:6px;}
  .cal-legenda-cor{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .cal-legenda-nome{font-size:12px;color:#7a6e5e;}

  /* Grade */
  .cal-grade-wrap{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;overflow:hidden;}
  .cal-grade-header{display:grid;grid-template-columns:52px repeat(7,1fr);border-bottom:1px solid #2a1f18;}
  .cal-hora-col-header{border-right:1px solid #2a1f18;}
  .cal-dia-header{padding:12px 8px;text-align:center;border-right:1px solid #2a1f18;display:flex;flex-direction:column;align-items:center;gap:4px;}
  .cal-dia-header:last-child{border-right:none;}
  .cal-dia-semana-nome{font-size:11px;color:#4a3e30;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
  .cal-dia-num{font-size:18px;font-weight:700;color:#7a6e5e;font-family:'Cormorant Garamond',Georgia,serif;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;}
  .dia-hoje .cal-dia-semana-nome{color:#c2904d;}
  .num-hoje{background:#c2904d;color:#0e0f09 !important;}

  /* Corpo */
  .cal-grade-body{display:grid;grid-template-columns:52px repeat(7,1fr);overflow-y:auto;max-height:600px;}
  .cal-hora-col{border-right:1px solid #2a1f18;}
  .cal-hora-cell{font-size:11px;color:#2a1f18;text-align:right;padding-right:8px;padding-top:4px;border-bottom:1px solid #1e1a14;box-sizing:border-box;}
  .cal-dia-col{border-right:1px solid #2a1f18;position:relative;box-sizing:border-box;}
  .cal-dia-col:last-child{border-right:none;}
  .cal-linha-hora{position:absolute;left:0;right:0;height:1px;background:#1e1a14;}

  /* Cards de agendamento */
  .cal-ag-card{position:absolute;left:2px;right:2px;border-radius:6px;border-left:3px solid;padding:3px 6px;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;gap:1px;transition:filter .15s;z-index:1;}
  .cal-ag-card:hover{filter:brightness(1.2);}
  .ag-cancelado{opacity:.4;}
  .cal-ag-hora{font-size:10px;color:#fff9e6;font-family:monospace;font-weight:700;}
  .cal-ag-nome{font-size:11px;color:#fff9e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .cal-ag-meet-icon{font-size:10px;opacity:.7;}

  /* Modal */
  .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;}
  .modal-card{background:#1a1410;border:1px solid #2a1f18;border-radius:20px;padding:28px;width:100%;max-width:480px;display:flex;flex-direction:column;gap:16px;max-height:90vh;overflow-y:auto;}
  .modal-header{display:flex;align-items:flex-start;justify-content:space-between;}
  .modal-titulo-wrap{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .modal-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#fff9e6;}
  .modal-status-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:#0e0f09;}
  .modal-fechar{background:none;border:1px solid #2a1f18;border-radius:8px;width:28px;height:28px;color:#7a6e5e;cursor:pointer;font-size:14px;flex-shrink:0;transition:all .15s;}
  .modal-fechar:hover{border-color:#c2904d;color:#c2904d;}

  .modal-pessoa{display:flex;align-items:center;gap:12px;padding:12px;background:#111009;border-radius:12px;}
  .modal-pessoa-avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#0e0f09;font-family:'Cormorant Garamond',Georgia,serif;flex-shrink:0;}
  .modal-pessoa-nome{font-size:15px;font-weight:700;color:#fff9e6;}
  .modal-pessoa-role{font-size:12px;color:#c2904d;margin-top:2px;}

  .modal-info-row{display:flex;gap:16px;flex-wrap:wrap;}
  .modal-info-item{display:flex;align-items:center;gap:8px;font-size:14px;color:#fff9e6;}
  .modal-info-icon{font-size:15px;}

  .modal-secao-titulo{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4a3e30;}
  .modal-lead-info{display:flex;flex-direction:column;gap:8px;background:#111009;border-radius:12px;padding:14px;}
  .modal-lead-row{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#fff9e6;line-height:1.5;}
  .modal-lead-icon{font-size:14px;flex-shrink:0;margin-top:1px;}
  .modal-lead-nome{font-weight:700;font-size:15px;}

  .modal-meet-btn{display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(79,142,247,.15);border:1px solid rgba(79,142,247,.4);border-radius:10px;padding:10px 16px;font-size:13px;color:#4F8EF7;text-decoration:none;transition:all .15s;font-family:inherit;}
  .modal-meet-btn:hover{background:rgba(79,142,247,.25);}

  .modal-acoes{display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid #2a1f18;padding-top:16px;}
  .modal-btn{border:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;}
  .modal-btn:disabled{opacity:.5;cursor:not-allowed;}
  .btn-iniciar{background:rgba(247,184,79,.15);color:#F7B84F;border:1px solid rgba(247,184,79,.3);}
  .btn-iniciar:hover:not(:disabled){background:rgba(247,184,79,.25);}
  .btn-finalizar{background:rgba(106,207,126,.15);color:#6ACF7E;border:1px solid rgba(106,207,126,.3);}
  .btn-finalizar:hover:not(:disabled){background:rgba(106,207,126,.25);}
  .btn-noshow{background:rgba(122,110,94,.15);color:#7a6e5e;border:1px solid rgba(122,110,94,.3);}
  .btn-noshow:hover:not(:disabled){background:rgba(122,110,94,.25);}
  .btn-cancelar{background:rgba(224,88,64,.1);color:#e05840;border:1px solid rgba(224,88,64,.3);}
  .btn-cancelar:hover:not(:disabled){background:rgba(224,88,64,.2);}

  @media(max-width:900px){
    .cal-root{padding:16px;}
    .cal-grade-body{max-height:500px;}
    .cal-dia-semana-nome{display:none;}
  }
`

"use client"

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const DIAS_NOMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type Horario = { id: string; dia_semana: number; inicio: string; fim: string; ativo: boolean }
type Excecao = { id: string; pessoa_id: string; data: string; tipo: 'bloqueado' | 'extra'; inicio: string | null; fim: string | null }
type Pessoa = { id: string; nome: string; role: string; foto_url: string | null; foto_pos_x: number; foto_pos_y: number; foto_scale: number; duracao_slot: number }

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function gerarSlots(date: Date, horarios: Horario[], excecoes: Excecao[], duracaoMin: number): string[] {
  const dataStr = toDateStr(date)
  const diaSemana = date.getDay()

  const bloqueioTotal = excecoes.some(e => e.data === dataStr && e.tipo === 'bloqueado' && !e.inicio)
  if (bloqueioTotal) return []

  const periodos: Array<{ inicio: string; fim: string }> = []

  horarios
    .filter(h => h.dia_semana === diaSemana && h.ativo)
    .forEach(h => periodos.push({ inicio: h.inicio.slice(0, 5), fim: h.fim.slice(0, 5) }))

  excecoes
    .filter(e => e.data === dataStr && e.tipo === 'extra' && e.inicio && e.fim)
    .forEach(e => periodos.push({ inicio: e.inicio!.slice(0, 5), fim: e.fim!.slice(0, 5) }))

  const slots: string[] = []
  for (const p of periodos) {
    const [hI, mI] = p.inicio.split(':').map(Number)
    const [hF, mF] = p.fim.split(':').map(Number)
    let cur = hI * 60 + mI
    const end = hF * 60 + mF
    while (cur + duracaoMin <= end) {
      slots.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`)
      cur += duracaoMin
    }
  }
  return slots.sort()
}

function temDisponibilidade(date: Date, horarios: Horario[], excecoes: Excecao[]): boolean {
  const dataStr = toDateStr(date)
  const bloqueado = excecoes.some(e => e.data === dataStr && e.tipo === 'bloqueado' && !e.inicio)
  if (bloqueado) return false
  const extra = excecoes.some(e => e.data === dataStr && e.tipo === 'extra' && e.inicio)
  if (extra) return true
  return horarios.some(h => h.dia_semana === date.getDay() && h.ativo)
}

export default function DisponibilidadeEditor({ pessoa, horariosIniciais, excecoesIniciais }: {
  pessoa: Pessoa
  horariosIniciais: Horario[]
  excecoesIniciais: Excecao[]
}) {
  const router = useRouter()
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [dataSel, setDataSel] = useState<Date>(hoje)
  const [excecoes, setExcecoes] = useState<Excecao[]>(excecoesIniciais)
  const [loading, setLoading] = useState(false)

  // Extra hours form
  const [mostrarExtra, setMostrarExtra] = useState(false)
  const [extraInicio, setExtraInicio] = useState('08:00')
  const [extraFim, setExtraFim] = useState('12:00')

  const dataSelStr = toDateStr(dataSel)
  const bloqueioTotal = excecoes.some(e => e.data === dataSelStr && e.tipo === 'bloqueado' && !e.inicio)
  const excExtra = excecoes.filter(e => e.data === dataSelStr && e.tipo === 'extra')
  const slots = gerarSlots(dataSel, horariosIniciais, excecoes, pessoa.duracao_slot)

  // Dias ativos na semana com base nos horários
  const diasAtivos = new Set(horariosIniciais.map(h => h.dia_semana))

  const diasDoMes = useCallback(() => {
    const ano = mes.getFullYear()
    const m = mes.getMonth()
    const primeiro = new Date(ano, m, 1)
    const ultimo = new Date(ano, m + 1, 0)
    const cells: (Date | null)[] = []
    for (let i = 0; i < primeiro.getDay(); i++) cells.push(null)
    for (let d = 1; d <= ultimo.getDate(); d++) cells.push(new Date(ano, m, d))
    return cells
  }, [mes])

  async function bloquearDia() {
    setLoading(true)
    const res = await fetch('/api/admin/agenda/excecoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pessoaId: pessoa.id, data: dataSelStr, tipo: 'bloqueado' }),
    })
    if (res.ok) {
      const nova = await res.json() as Excecao
      setExcecoes(prev => [...prev, nova])
    }
    setLoading(false)
  }

  async function desbloquearDia() {
    setLoading(true)
    const exc = excecoes.find(e => e.data === dataSelStr && e.tipo === 'bloqueado' && !e.inicio)
    if (exc) {
      await fetch(`/api/admin/agenda/excecoes?id=${exc.id}`, { method: 'DELETE' })
      setExcecoes(prev => prev.filter(e => e.id !== exc.id))
    }
    setLoading(false)
  }

  async function adicionarExtra() {
    setLoading(true)
    const res = await fetch('/api/admin/agenda/excecoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pessoaId: pessoa.id, data: dataSelStr, tipo: 'extra', inicio: extraInicio, fim: extraFim }),
    })
    if (res.ok) {
      const nova = await res.json() as Excecao
      setExcecoes(prev => [...prev, nova])
      setMostrarExtra(false)
    }
    setLoading(false)
  }

  async function removerExtra(id: string) {
    await fetch(`/api/admin/agenda/excecoes?id=${id}`, { method: 'DELETE' })
    setExcecoes(prev => prev.filter(e => e.id !== id))
  }

  const cells = diasDoMes()

  const manha = slots.filter(s => parseInt(s.split(':')[0]) < 12)
  const tarde = slots.filter(s => parseInt(s.split(':')[0]) >= 12)

  return (
    <>
      <style>{css}</style>
      <div className="dv-root">
        {/* Header */}
        <div className="dv-header">
          <button className="dv-back" onClick={() => router.push(`/dashboard/agenda/${pessoa.id}`)}>← Voltar</button>
          <div>
            <h1 className="dv-titulo">Disponibilidade</h1>
            <p className="dv-sub">Clique num dia para ver os slots • Bloqueie dias ou adicione horários extras</p>
          </div>
        </div>

        <div className="dv-body">
          {/* Painel esquerdo — perfil */}
          <aside className="dv-perfil">
            <div className="dv-foto-circle">
              {pessoa.foto_url ? (
                <img src={pessoa.foto_url} alt={pessoa.nome} style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: `translate(calc(-50% + ${pessoa.foto_pos_x}px), calc(-50% + ${pessoa.foto_pos_y}px)) scale(${pessoa.foto_scale})`,
                  width: '200%', height: '200%', objectFit: 'cover',
                }} />
              ) : (
                <span className="dv-foto-inicial">{pessoa.nome.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <p className="dv-perfil-nome">{pessoa.nome}</p>
            {pessoa.role && <p className="dv-perfil-role">{pessoa.role}</p>}
            <div className="dv-perfil-sep" />
            <p className="dv-perfil-label">Dias da semana</p>
            <div className="dv-dias-chips">
              {DIAS_SEMANA.map((d, i) => (
                <span key={i} className={`dv-dia-chip ${diasAtivos.has(i) ? 'chip-on' : ''}`}>{d}</span>
              ))}
            </div>
            <p className="dv-perfil-duracao">⏱ {pessoa.duracao_slot} min / sessão</p>
          </aside>

          {/* Calendário */}
          <div className="dv-cal-wrap">
            <div className="dv-cal-nav">
              <button className="dv-nav-btn" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}>‹</button>
              <span className="dv-cal-mes">{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
              <button className="dv-nav-btn" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}>›</button>
            </div>
            <div className="dv-cal-grid">
              {DIAS_SEMANA.map(d => <div key={d} className="dv-cal-head">{d}</div>)}
              {cells.map((date, idx) => {
                if (!date) return <div key={`empty-${idx}`} className="dv-cal-empty" />
                const str = toDateStr(date)
                const isSel = str === dataSelStr
                const isBloq = excecoes.some(e => e.data === str && e.tipo === 'bloqueado' && !e.inicio)
                const temDisp = temDisponibilidade(date, horariosIniciais, excecoes)
                const isHoje = str === toDateStr(hoje)
                return (
                  <button
                    key={str}
                    className={`dv-cal-day ${isSel ? 'day-sel' : ''} ${isHoje ? 'day-hoje' : ''} ${isBloq ? 'day-bloq' : ''}`}
                    onClick={() => setDataSel(date)}
                  >
                    {date.getDate()}
                    {temDisp && !isBloq && <span className="dv-dot dot-green" />}
                    {isBloq && <span className="dv-dot dot-red" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Painel direito — slots */}
          <div className="dv-slots-panel">
            <div className="dv-slots-header">
              <p className="dv-slots-dia-nome">{DIAS_NOMES[dataSel.getDay()]}</p>
              <p className="dv-slots-data">
                {dataSel.getDate()} de {MESES[dataSel.getMonth()]}
              </p>
            </div>

            {/* Ações do dia */}
            <div className="dv-acoes">
              {bloqueioTotal ? (
                <button className="dv-btn-desbloquear" onClick={desbloquearDia} disabled={loading}>
                  ✓ Desbloquear dia
                </button>
              ) : (
                <button className="dv-btn-bloquear" onClick={bloquearDia} disabled={loading}>
                  ✕ Bloquear dia inteiro
                </button>
              )}
              {!bloqueioTotal && (
                <button className="dv-btn-extra" onClick={() => setMostrarExtra(!mostrarExtra)} type="button">
                  + Horário extra
                </button>
              )}
            </div>

            {/* Form horário extra */}
            {mostrarExtra && !bloqueioTotal && (
              <div className="dv-extra-form">
                <div className="dv-extra-row">
                  <input type="time" className="dv-time" value={extraInicio} onChange={e => setExtraInicio(e.target.value)} />
                  <span className="dv-ate">até</span>
                  <input type="time" className="dv-time" value={extraFim} onChange={e => setExtraFim(e.target.value)} />
                  <button className="dv-btn-add-extra" onClick={adicionarExtra} disabled={loading}>Adicionar</button>
                </div>
              </div>
            )}

            {/* Extras cadastrados */}
            {excExtra.length > 0 && (
              <div className="dv-extras-lista">
                {excExtra.map(e => (
                  <div key={e.id} className="dv-extra-item">
                    <span className="dv-extra-badge">extra</span>
                    <span>{e.inicio?.slice(0,5)} – {e.fim?.slice(0,5)}</span>
                    <button className="dv-extra-del" onClick={() => removerExtra(e.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Slots */}
            {bloqueioTotal ? (
              <div className="dv-bloqueado-msg">🔒 Dia bloqueado</div>
            ) : slots.length === 0 ? (
              <div className="dv-sem-slots">Sem disponibilidade neste dia</div>
            ) : (
              <div className="dv-slots-body">
                {manha.length > 0 && (
                  <div className="dv-turno">
                    <span className="dv-turno-label">☀ Manhã</span>
                    <div className="dv-slots-grid">
                      {manha.map(s => <div key={s} className="dv-slot">{s}</div>)}
                    </div>
                  </div>
                )}
                {tarde.length > 0 && (
                  <div className="dv-turno">
                    <span className="dv-turno-label">🌤 Tarde</span>
                    <div className="dv-slots-grid">
                      {tarde.map(s => <div key={s} className="dv-slot">{s}</div>)}
                    </div>
                  </div>
                )}
                <p className="dv-slots-count">{slots.length} horário{slots.length !== 1 ? 's' : ''} disponível{slots.length !== 1 ? 'is' : ''}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const css = `
  .dv-root{padding:28px 32px;max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:20px;}
  .dv-header{display:flex;align-items:flex-start;gap:16px;}
  .dv-back{background:none;border:none;color:#7a6e5e;font-size:14px;cursor:pointer;font-family:inherit;padding:0;transition:color .15s;margin-top:4px;white-space:nowrap;}
  .dv-back:hover{color:#c2904d;}
  .dv-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#fff9e6;}
  .dv-sub{font-size:12px;color:#4a3e30;margin-top:2px;}
  .dv-body{display:grid;grid-template-columns:220px 1fr 240px;gap:16px;align-items:start;}

  /* Perfil */
  .dv-perfil{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;}
  .dv-foto-circle{width:80px;height:80px;border-radius:50%;overflow:hidden;position:relative;background:#2a1f18;border:2px solid #3a2f28;flex-shrink:0;}
  .dv-foto-inicial{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:#c2904d;font-family:'Cormorant Garamond',Georgia,serif;}
  .dv-perfil-nome{font-size:15px;font-weight:700;color:#fff9e6;font-family:'Cormorant Garamond',Georgia,serif;}
  .dv-perfil-role{font-size:11px;color:#c2904d;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
  .dv-perfil-sep{width:100%;height:1px;background:#2a1f18;}
  .dv-perfil-label{font-size:10px;color:#4a3e30;font-weight:700;letter-spacing:1px;text-transform:uppercase;align-self:flex-start;}
  .dv-dias-chips{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;}
  .dv-dia-chip{padding:3px 8px;border-radius:20px;font-size:11px;background:#111009;border:1px solid #2a1f18;color:#4a3e30;}
  .dv-dia-chip.chip-on{background:rgba(106,204,160,.1);border-color:rgba(106,204,160,.3);color:#6acca0;}
  .dv-perfil-duracao{font-size:12px;color:#7a6e5e;}

  /* Calendário */
  .dv-cal-wrap{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px;}
  .dv-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
  .dv-nav-btn{background:none;border:1px solid #2a1f18;border-radius:8px;width:32px;height:32px;color:#7a6e5e;font-size:18px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;}
  .dv-nav-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .dv-cal-mes{font-size:15px;font-weight:700;color:#fff9e6;font-family:'Cormorant Garamond',Georgia,serif;}
  .dv-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  .dv-cal-head{text-align:center;font-size:11px;color:#4a3e30;font-weight:700;padding:4px 0;text-transform:uppercase;}
  .dv-cal-empty{height:36px;}
  .dv-cal-day{background:none;border:1px solid transparent;border-radius:8px;height:36px;font-size:13px;color:#7a6e5e;cursor:pointer;font-family:inherit;transition:all .15s;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;position:relative;}
  .dv-cal-day:hover{background:rgba(255,255,255,.04);border-color:#2a1f18;color:#fff9e6;}
  .day-sel{background:rgba(194,144,77,.15)!important;border-color:rgba(194,144,77,.4)!important;color:#c2904d!important;font-weight:700;}
  .day-hoje{border-color:#2a1f18!important;color:#fff9e6!important;}
  .day-bloq{opacity:.5;}
  .dv-dot{width:5px;height:5px;border-radius:50%;}
  .dot-green{background:#6acca0;}
  .dot-red{background:#e05840;}

  /* Slots panel */
  .dv-slots-panel{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px;}
  .dv-slots-header{border-bottom:1px solid #2a1f18;padding-bottom:12px;}
  .dv-slots-dia-nome{font-size:12px;color:#4a3e30;font-weight:700;text-transform:uppercase;letter-spacing:1px;}
  .dv-slots-data{font-size:20px;font-weight:700;color:#fff9e6;font-family:'Cormorant Garamond',Georgia,serif;margin-top:2px;}
  .dv-acoes{display:flex;flex-direction:column;gap:6px;}
  .dv-btn-bloquear{background:rgba(224,88,64,.08);border:1px solid rgba(224,88,64,.3);border-radius:8px;padding:8px 12px;font-size:12px;color:#e07070;cursor:pointer;font-family:inherit;transition:all .15s;}
  .dv-btn-bloquear:hover:not(:disabled){background:rgba(224,88,64,.15);}
  .dv-btn-desbloquear{background:rgba(106,204,160,.08);border:1px solid rgba(106,204,160,.3);border-radius:8px;padding:8px 12px;font-size:12px;color:#6acca0;cursor:pointer;font-family:inherit;transition:all .15s;}
  .dv-btn-desbloquear:hover:not(:disabled){background:rgba(106,204,160,.15);}
  .dv-btn-extra{background:rgba(194,144,77,.06);border:1px dashed rgba(194,144,77,.3);border-radius:8px;padding:7px 12px;font-size:12px;color:#c2904d;cursor:pointer;font-family:inherit;transition:all .15s;}
  .dv-btn-extra:hover{background:rgba(194,144,77,.12);}
  .dv-extra-form{background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:12px;}
  .dv-extra-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
  .dv-time{background:#0e0f09;border:1px solid #2a1f18;border-radius:6px;padding:5px 8px;font-size:12px;color:#fff9e6;font-family:monospace;outline:none;width:90px;}
  .dv-time:focus{border-color:rgba(194,144,77,.4);}
  .dv-ate{font-size:11px;color:#4a3e30;}
  .dv-btn-add-extra{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}
  .dv-extras-lista{display:flex;flex-direction:column;gap:4px;}
  .dv-extra-item{display:flex;align-items:center;gap:8px;background:#111009;border:1px solid rgba(194,144,77,.2);border-radius:8px;padding:6px 10px;font-size:12px;color:#c2904d;}
  .dv-extra-badge{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:rgba(194,144,77,.15);border-radius:4px;padding:2px 5px;}
  .dv-extra-del{background:none;border:none;cursor:pointer;color:#4a3e30;font-size:12px;margin-left:auto;transition:color .15s;}
  .dv-extra-del:hover{color:#e07070;}
  .dv-bloqueado-msg{font-size:14px;color:#4a3e30;text-align:center;padding:20px 0;}
  .dv-sem-slots{font-size:13px;color:#4a3e30;text-align:center;padding:20px 0;font-style:italic;}
  .dv-slots-body{display:flex;flex-direction:column;gap:12px;}
  .dv-turno{display:flex;flex-direction:column;gap:8px;}
  .dv-turno-label{font-size:11px;font-weight:700;color:#7a6e5e;text-transform:uppercase;letter-spacing:.5px;}
  .dv-slots-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;}
  .dv-slot{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:7px 8px;font-size:12px;color:#6acca0;font-family:monospace;text-align:center;}
  .dv-slots-count{font-size:11px;color:#4a3e30;text-align:center;padding-top:4px;}

  @media(max-width:900px){
    .dv-body{grid-template-columns:1fr;}
    .dv-root{padding:16px;}
  }
`

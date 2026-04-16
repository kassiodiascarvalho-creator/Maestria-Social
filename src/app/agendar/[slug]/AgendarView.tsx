"use client"

import { useState, useMemo } from 'react'

type Horario = { id: string; dia_semana: number; inicio: string; fim: string; ativo: boolean }
type Excecao = { id: string; data: string; tipo: 'bloqueio' | 'horario_extra'; inicio: string | null; fim: string | null }
type Campo = { id: string; nome: string; tipo: string; obrigatorio: boolean; ordem: number }
type Pessoa = { id: string; nome: string; role: string; foto_url: string | null; foto_pos_x: number; foto_pos_y: number; foto_scale: number; duracao_slot: number; slug: string }

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function gerarSlots(data: Date, horarios: Horario[], excecoes: Excecao[], duracao: number): string[] {
  const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  const diaSemana = data.getDay()
  const excecaoDia = excecoes.find(e => e.data === dataStr)

  if (excecaoDia?.tipo === 'bloqueio') return []

  let periodos: { inicio: string; fim: string }[] = []

  if (excecaoDia?.tipo === 'horario_extra' && excecaoDia.inicio && excecaoDia.fim) {
    periodos = [{ inicio: excecaoDia.inicio.slice(0, 5), fim: excecaoDia.fim.slice(0, 5) }]
  } else {
    periodos = horarios
      .filter(h => h.dia_semana === diaSemana && h.ativo)
      .map(h => ({ inicio: h.inicio.slice(0, 5), fim: h.fim.slice(0, 5) }))
  }

  const slots: string[] = []
  for (const p of periodos) {
    let atual = p.inicio
    while (addMinutes(atual, duracao) <= p.fim) {
      slots.push(atual)
      atual = addMinutes(atual, duracao)
    }
  }
  return slots
}

function temDisponibilidade(data: Date, horarios: Horario[], excecoes: Excecao[], duracao: number): boolean {
  return gerarSlots(data, horarios, excecoes, duracao).length > 0
}

function diasDoMes(ano: number, mes: number): (Date | null)[] {
  const primeiro = new Date(ano, mes, 1)
  const ultimo = new Date(ano, mes + 1, 0)
  const dias: (Date | null)[] = Array(primeiro.getDay()).fill(null)
  for (let d = 1; d <= ultimo.getDate(); d++) dias.push(new Date(ano, mes, d))
  return dias
}

function getPlaceholder(nome: string, tipo: string): string {
  const n = nome.toLowerCase()
  if (tipo === 'email' || n.includes('email') || n.includes('e-mail')) return 'Ex: joao@email.com'
  if (tipo === 'tel' || n.includes('whatsapp') || n.includes('telefone') || n.includes('celular')) return 'Ex: 11 99999-9999'
  if (n.includes('nome')) return 'Ex: João Silva'
  if (tipo === 'number' || n.includes('número') || n.includes('numero')) return 'Ex: 30'
  if (tipo === 'date') return ''
  if (tipo === 'textarea') return 'Escreva aqui…'
  return 'Digite aqui…'
}

export default function AgendarView({ pessoa, horarios, excecoes, campos }: {
  pessoa: Pessoa
  horarios: Horario[]
  excecoes: Excecao[]
  campos: Campo[]
}) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [dataSel, setDataSel] = useState<Date | null>(null)
  const [slotSel, setSlotSel] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  const diasCalendario = useMemo(() => diasDoMes(ano, mes), [ano, mes])

  const slots = useMemo(() =>
    dataSel ? gerarSlots(dataSel, horarios, excecoes, pessoa.duracao_slot) : [],
    [dataSel, horarios, excecoes, pessoa.duracao_slot]
  )

  function prevMes() {
    if (mes === 0) { setMes(11); setAno(a => a - 1) }
    else setMes(m => m - 1)
  }

  function nextMes() {
    if (mes === 11) { setMes(0); setAno(a => a + 1) }
    else setMes(m => m + 1)
  }

  function selecionarDia(d: Date) {
    if (d < hoje) return
    if (!temDisponibilidade(d, horarios, excecoes, pessoa.duracao_slot)) return
    setDataSel(d)
    setSlotSel(null)
  }

  const fotoStyle = pessoa.foto_url ? {
    backgroundImage: `url(${pessoa.foto_url})`,
    backgroundSize: `${(pessoa.foto_scale ?? 1) * 100}%`,
    backgroundPosition: `${50 + (pessoa.foto_pos_x ?? 0)}% ${50 + (pessoa.foto_pos_y ?? 0)}%`,
  } : {}

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!dataSel || !slotSel) { setErro('Selecione data e horário'); return }
    for (const c of campos) {
      if (c.obrigatorio && !form[c.nome]?.trim()) {
        setErro(`Campo obrigatório: ${c.nome}`)
        return
      }
    }
    setErro(''); setEnviando(true)

    const dataStr = `${dataSel.getFullYear()}-${String(dataSel.getMonth() + 1).padStart(2, '0')}-${String(dataSel.getDate()).padStart(2, '0')}`
    const res = await fetch('/api/agendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pessoaId: pessoa.id,
        data: dataStr,
        horario: slotSel,
        duracao: pessoa.duracao_slot,
        campos: form,
      }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErro(j.error ?? 'Erro ao agendar')
      setEnviando(false)
      return
    }

    setSucesso(true)
    setEnviando(false)
  }

  if (sucesso) {
    return (
      <>
        <style>{css}</style>
        <div className="ag-root">
          <div className="ag-sucesso-card">
            <div className="ag-sucesso-icon">✓</div>
            <h2 className="ag-sucesso-titulo">Agendamento confirmado!</h2>
            <p className="ag-sucesso-desc">
              Você receberá uma confirmação em breve.<br />
              Até logo, {form['nome'] || 'você'}!
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{css}</style>
      <div className="ag-root">
        {/* Coluna esquerda — perfil */}
        <aside className="ag-perfil">
          <div className="ag-foto-wrap">
            {pessoa.foto_url
              ? <div className="ag-foto" style={fotoStyle} />
              : <div className="ag-foto ag-foto-vazia"><span>{pessoa.nome[0]}</span></div>
            }
          </div>
          <h1 className="ag-nome">{pessoa.nome}</h1>
          {pessoa.role && <p className="ag-role">{pessoa.role}</p>}
          <div className="ag-duracao-badge">⏱ {pessoa.duracao_slot} min</div>
          <p className="ag-descricao">Escolha uma data e horário disponíveis para agendar sua sessão.</p>
        </aside>

        {/* Coluna central — calendário */}
        <div className="ag-calendario-col">
          <div className="ag-cal-nav">
            <button className="ag-cal-arrow" onClick={prevMes} type="button">‹</button>
            <span className="ag-cal-mes">{MESES[mes]} {ano}</span>
            <button className="ag-cal-arrow" onClick={nextMes} type="button">›</button>
          </div>
          <div className="ag-cal-dias-semana">
            {DIAS_SEMANA.map(d => <span key={d} className="ag-cal-ds">{d}</span>)}
          </div>
          <div className="ag-cal-grid">
            {diasCalendario.map((d, i) => {
              if (!d) return <div key={`e${i}`} />
              const passado = d < hoje
              const temSlots = !passado && temDisponibilidade(d, horarios, excecoes, pessoa.duracao_slot)
              const sel = dataSel?.toDateString() === d.toDateString()
              return (
                <button
                  key={d.toISOString()}
                  className={`ag-cal-dia ${passado ? 'ag-dia-passado' : ''} ${temSlots ? 'ag-dia-disp' : 'ag-dia-indisp'} ${sel ? 'ag-dia-sel' : ''}`}
                  onClick={() => selecionarDia(d)}
                  disabled={passado || !temSlots}
                  type="button"
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Slots */}
          {dataSel && (
            <div className="ag-slots-area">
              <div className="ag-slots-titulo">
                {dataSel.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              {slots.length === 0 ? (
                <p className="ag-sem-slots">Sem horários disponíveis neste dia.</p>
              ) : (
                <div className="ag-slots-grid">
                  {slots.map(s => (
                    <button
                      key={s}
                      className={`ag-slot-btn ${slotSel === s ? 'ag-slot-sel' : ''}`}
                      onClick={() => setSlotSel(s)}
                      type="button"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coluna direita — formulário */}
        <div className={`ag-form-col ${dataSel && slotSel ? 'ag-form-col--visible' : ''}`}>
          {dataSel && slotSel ? (
            <form className="ag-form" onSubmit={enviar}>
              <div className="ag-form-resumo">
                <span className="ag-form-resumo-data">
                  {dataSel.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} às {slotSel}
                </span>
                <span className="ag-form-resumo-dur">{pessoa.duracao_slot} min</span>
              </div>

              {campos.map(c => (
                <div key={c.id} className="ag-campo-wrap">
                  <label className="ag-campo-label">
                    {c.nome}
                    {c.obrigatorio && <span className="ag-obrig-star"> *</span>}
                  </label>
                  {c.tipo === 'textarea' ? (
                    <textarea
                      className="ag-campo-input ag-campo-textarea"
                      placeholder={getPlaceholder(c.nome, c.tipo)}
                      value={form[c.nome] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [c.nome]: e.target.value }))}
                      required={c.obrigatorio}
                      rows={3}
                    />
                  ) : (
                    <input
                      className="ag-campo-input"
                      type={c.tipo}
                      placeholder={getPlaceholder(c.nome, c.tipo)}
                      value={form[c.nome] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [c.nome]: e.target.value }))}
                      required={c.obrigatorio}
                    />
                  )}
                </div>
              ))}

              {erro && <div className="ag-erro">{erro}</div>}

              <button className="ag-confirmar-btn" type="submit" disabled={enviando}>
                {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
              </button>
            </form>
          ) : (
            <div className="ag-form-placeholder">
              <span className="ag-form-ph-icon">📅</span>
              <p>Selecione uma data e horário ao lado para preencher o formulário.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const css = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0e0f09;color:#fff9e6;font-family:'Inter',system-ui,sans-serif;}
  .ag-root{min-height:100vh;display:grid;grid-template-columns:260px 1fr 320px;gap:0;background:#0e0f09;max-width:1100px;margin:0 auto;padding:40px 24px;}

  /* Perfil */
  .ag-perfil{display:flex;flex-direction:column;align-items:center;padding:32px 24px;gap:12px;border-right:1px solid #1a1410;}
  .ag-foto-wrap{width:100px;height:100px;border-radius:50%;overflow:hidden;border:2px solid #2a1f18;flex-shrink:0;}
  .ag-foto{width:100%;height:100%;background-size:cover;background-position:center;}
  .ag-foto-vazia{background:#1a1410;display:flex;align-items:center;justify-content:center;font-size:36px;color:#c2904d;font-family:'Cormorant Garamond',Georgia,serif;}
  .ag-nome{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:700;color:#fff9e6;text-align:center;}
  .ag-role{font-size:13px;color:#7a6e5e;text-align:center;}
  .ag-duracao-badge{background:rgba(194,144,77,.1);border:1px solid rgba(194,144,77,.2);border-radius:20px;padding:4px 12px;font-size:12px;color:#c2904d;}
  .ag-descricao{font-size:12px;color:#4a3e30;text-align:center;line-height:1.6;}

  /* Calendário */
  .ag-calendario-col{padding:32px 28px;border-right:1px solid #1a1410;display:flex;flex-direction:column;gap:20px;}
  .ag-cal-nav{display:flex;align-items:center;justify-content:space-between;}
  .ag-cal-mes{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:700;color:#fff9e6;}
  .ag-cal-arrow{background:none;border:1px solid #2a1f18;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:18px;color:#7a6e5e;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .ag-cal-arrow:hover{border-color:rgba(194,144,77,.4);color:#c2904d;}
  .ag-cal-dias-semana{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  .ag-cal-ds{text-align:center;font-size:11px;color:#4a3e30;font-weight:600;padding:4px 0;}
  .ag-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  .ag-cal-dia{width:100%;aspect-ratio:1;border-radius:8px;border:1px solid transparent;font-size:13px;font-family:inherit;cursor:pointer;transition:all .15s;background:transparent;color:#7a6e5e;}
  .ag-dia-passado{color:#2a1f18 !important;cursor:not-allowed;}
  .ag-dia-indisp{cursor:not-allowed;color:#2a1f18;}
  .ag-dia-disp{color:#fff9e6;border-color:#2a1f18;}
  .ag-dia-disp:hover{background:rgba(194,144,77,.1);border-color:rgba(194,144,77,.3);}
  .ag-dia-sel{background:rgba(194,144,77,.2) !important;border-color:#c2904d !important;color:#c2904d !important;font-weight:700;}

  /* Slots */
  .ag-slots-area{display:flex;flex-direction:column;gap:12px;}
  .ag-slots-titulo{font-size:13px;color:#7a6e5e;text-transform:capitalize;}
  .ag-sem-slots{font-size:13px;color:#4a3e30;font-style:italic;}
  .ag-slots-grid{display:flex;flex-wrap:wrap;gap:8px;}
  .ag-slot-btn{background:#1a1410;border:1px solid #2a1f18;border-radius:8px;padding:8px 16px;font-size:13px;color:#fff9e6;font-family:monospace;cursor:pointer;transition:all .15s;}
  .ag-slot-btn:hover{border-color:rgba(194,144,77,.4);color:#c2904d;}
  .ag-slot-sel{background:rgba(194,144,77,.15) !important;border-color:#c2904d !important;color:#c2904d !important;font-weight:700;}

  /* Formulário */
  .ag-form-col{padding:32px 28px;display:flex;flex-direction:column;}
  .ag-form-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:#4a3e30;text-align:center;font-size:14px;line-height:1.6;}
  .ag-form-ph-icon{font-size:36px;opacity:.4;}
  .ag-form{display:flex;flex-direction:column;gap:16px;}
  .ag-form-resumo{background:#1a1410;border:1px solid rgba(194,144,77,.2);border-radius:12px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}
  .ag-form-resumo-data{font-size:13px;color:#fff9e6;text-transform:capitalize;}
  .ag-form-resumo-dur{font-size:12px;color:#c2904d;}
  .ag-campo-wrap{display:flex;flex-direction:column;gap:6px;}
  .ag-campo-label{font-size:13px;color:#7a6e5e;}
  .ag-obrig-star{color:#c2904d;}
  .ag-campo-input{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:10px 14px;font-size:14px;color:#fff9e6;font-family:inherit;outline:none;transition:border-color .2s;width:100%;}
  .ag-campo-input:focus{border-color:rgba(194,144,77,.4);}
  .ag-campo-textarea{resize:vertical;}
  .ag-erro{background:rgba(224,88,64,.1);border:1px solid rgba(224,88,64,.3);border-radius:10px;padding:12px 16px;font-size:13px;color:#e05840;}
  .ag-confirmar-btn{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;width:100%;}
  .ag-confirmar-btn:hover:not(:disabled){filter:brightness(1.08);}
  .ag-confirmar-btn:disabled{opacity:.6;cursor:not-allowed;}

  /* Sucesso */
  .ag-sucesso-card{display:flex;flex-direction:column;align-items:center;gap:20px;padding:80px 40px;text-align:center;}
  .ag-sucesso-icon{width:72px;height:72px;border-radius:50%;background:rgba(194,144,77,.15);border:2px solid #c2904d;display:flex;align-items:center;justify-content:center;font-size:32px;color:#c2904d;}
  .ag-sucesso-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:#fff9e6;}
  .ag-sucesso-desc{font-size:15px;color:#7a6e5e;line-height:1.7;}

  @media(max-width:900px){
    .ag-root{grid-template-columns:1fr;padding:20px 16px;}
    .ag-perfil{border-right:none;border-bottom:1px solid #1a1410;flex-direction:row;flex-wrap:wrap;padding:20px 0;}
    .ag-calendario-col{border-right:none;padding:20px 0;}
    .ag-form-col{padding:20px 0;}
    .ag-form-col--visible{}
  }
`

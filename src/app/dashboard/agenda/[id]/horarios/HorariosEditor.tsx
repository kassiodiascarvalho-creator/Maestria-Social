"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Periodo = { id: string; inicio: string; fim: string; ativo: boolean }
type DiaState = { periodos: Periodo[] }

type Horario = { id: string; dia_semana: number; inicio: string; fim: string; ativo: boolean }
type Pessoa = { id: string; nome: string; role: string; foto_url: string | null; foto_pos_x: number; foto_pos_y: number; foto_scale: number }

function uid() { return Math.random().toString(36).slice(2) }

function horariosParaDias(horarios: Horario[]): DiaState[] {
  const dias: DiaState[] = Array.from({ length: 7 }, () => ({ periodos: [] }))
  for (const h of horarios) {
    dias[h.dia_semana].periodos.push({ id: uid(), inicio: h.inicio.slice(0, 5), fim: h.fim.slice(0, 5), ativo: h.ativo })
  }
  return dias
}

export default function HorariosEditor({ pessoa, horariosIniciais }: { pessoa: Pessoa; horariosIniciais: Horario[] }) {
  const router = useRouter()
  const [dias, setDias] = useState<DiaState[]>(() => horariosParaDias(horariosIniciais))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [erro, setErro] = useState('')

  function addPeriodo(diaIdx: number) {
    setDias(prev => {
      const novos = prev.map((d, i) => i === diaIdx
        ? { periodos: [...d.periodos, { id: uid(), inicio: '08:00', fim: '12:00', ativo: true }] }
        : d)
      return novos
    })
  }

  function removePeriodo(diaIdx: number, pid: string) {
    setDias(prev => prev.map((d, i) => i === diaIdx
      ? { periodos: d.periodos.filter(p => p.id !== pid) }
      : d))
  }

  function updatePeriodo(diaIdx: number, pid: string, campo: Partial<Periodo>) {
    setDias(prev => prev.map((d, i) => i === diaIdx
      ? { periodos: d.periodos.map(p => p.id === pid ? { ...p, ...campo } : p) }
      : d))
  }

  function copiarSegParaSemana() {
    const seg = dias[1]
    setDias(prev => prev.map((d, i) =>
      i >= 2 && i <= 5
        ? { periodos: seg.periodos.map(p => ({ ...p, id: uid() })) }
        : d))
  }

  async function salvar() {
    setSaving(true); setErro('')
    const horarios: Array<{ dia_semana: number; inicio: string; fim: string; ativo: boolean }> = []
    dias.forEach((d, i) => {
      d.periodos.forEach(p => {
        if (p.inicio && p.fim) horarios.push({ dia_semana: i, inicio: p.inicio, fim: p.fim, ativo: p.ativo })
      })
    })

    const res = await fetch('/api/admin/agenda/horarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pessoaId: pessoa.id, horarios }),
    })

    if (!res.ok) { setErro('Erro ao salvar'); setSaving(false); return }
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  return (
    <>
      <style>{css}</style>
      <div className="hr-root">
        {/* Header */}
        <div className="hr-header">
          <div className="hr-header-left">
            <button className="hr-back" onClick={() => router.push(`/dashboard/agenda/${pessoa.id}`)}>← Voltar</button>
            <div>
              <h1 className="hr-titulo">Horários — {pessoa.nome}</h1>
              {pessoa.role && <p className="hr-sub">{pessoa.role}</p>}
            </div>
          </div>
          <div className="hr-header-actions">
            <button className="hr-copiar-btn" onClick={copiarSegParaSemana} type="button">
              ⎘ Copiar Seg → Sem
            </button>
            <button className="hr-salvar-btn" onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar'}
            </button>
          </div>
        </div>

        {erro && <div className="hr-erro">{erro}</div>}

        {/* Grade semanal */}
        <div className="hr-dias">
          {DIAS.map((nomeDia, diaIdx) => {
            const periodos = dias[diaIdx].periodos
            return (
              <div key={diaIdx} className="hr-dia-card">
                <div className="hr-dia-header">
                  <span className="hr-dia-nome">{nomeDia}</span>
                  <button className="hr-add-periodo" onClick={() => addPeriodo(diaIdx)} type="button">
                    + Período
                  </button>
                </div>
                {periodos.length === 0 ? (
                  <p className="hr-sem-horario">Sem horários configurados</p>
                ) : (
                  <div className="hr-periodos">
                    {periodos.map(p => (
                      <div key={p.id} className="hr-periodo-row">
                        {/* Toggle ativo */}
                        <button
                          className={`hr-toggle ${p.ativo ? 'tog-on' : 'tog-off'}`}
                          onClick={() => updatePeriodo(diaIdx, p.id, { ativo: !p.ativo })}
                          type="button"
                        >
                          <span className="tog-knob" />
                        </button>
                        <input
                          className="hr-time-input"
                          type="time"
                          value={p.inicio}
                          onChange={e => updatePeriodo(diaIdx, p.id, { inicio: e.target.value })}
                        />
                        <span className="hr-ate">até</span>
                        <input
                          className="hr-time-input"
                          type="time"
                          value={p.fim}
                          onChange={e => updatePeriodo(diaIdx, p.id, { fim: e.target.value })}
                        />
                        <button
                          className="hr-del-btn"
                          onClick={() => removePeriodo(diaIdx, p.id)}
                          type="button"
                          title="Remover período"
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rodapé salvar mobile */}
        <div className="hr-footer-mobile">
          <button className="hr-salvar-btn" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar horários'}
          </button>
        </div>
      </div>
    </>
  )
}

const css = `
  .hr-root{padding:28px 32px;max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:20px;}
  .hr-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .hr-header-left{display:flex;align-items:flex-start;gap:16px;}
  .hr-back{background:none;border:none;color:#7a6e5e;font-size:14px;cursor:pointer;font-family:inherit;padding:0;transition:color .15s;white-space:nowrap;margin-top:4px;}
  .hr-back:hover{color:#c2904d;}
  .hr-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#fff9e6;}
  .hr-sub{font-size:12px;color:#4a3e30;margin-top:2px;}
  .hr-header-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
  .hr-copiar-btn{background:rgba(255,255,255,.04);border:1px solid #2a1f18;border-radius:10px;padding:10px 18px;font-size:13px;color:#7a6e5e;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .hr-copiar-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .hr-salvar-btn{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:10px;padding:11px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;white-space:nowrap;}
  .hr-salvar-btn:hover:not(:disabled){filter:brightness(1.08);}
  .hr-salvar-btn:disabled{opacity:.6;cursor:not-allowed;}
  .hr-erro{background:rgba(224,88,64,.1);border:1px solid rgba(224,88,64,.3);border-radius:10px;padding:12px 16px;font-size:14px;color:#e05840;}
  .hr-dias{display:flex;flex-direction:column;gap:12px;}
  .hr-dia-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:20px 24px;display:flex;flex-direction:column;gap:12px;}
  .hr-dia-header{display:flex;align-items:center;justify-content:space-between;}
  .hr-dia-nome{font-size:15px;font-weight:700;color:#fff9e6;font-family:'Cormorant Garamond',Georgia,serif;}
  .hr-add-periodo{background:none;border:1px dashed rgba(194,144,77,.3);border-radius:8px;padding:5px 14px;font-size:12px;color:#c2904d;cursor:pointer;font-family:inherit;transition:all .15s;}
  .hr-add-periodo:hover{background:rgba(194,144,77,.08);}
  .hr-sem-horario{font-size:13px;color:#4a3e30;font-style:italic;}
  .hr-periodos{display:flex;flex-direction:column;gap:8px;}
  .hr-periodo-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .hr-toggle{width:40px;height:22px;border-radius:99px;border:none;cursor:pointer;position:relative;flex-shrink:0;transition:background .2s;}
  .tog-on{background:#c2904d;}
  .tog-off{background:#2a1f18;}
  .tog-knob{position:absolute;top:3px;width:16px;height:16px;border-radius:50%;background:#fff9e6;transition:left .2s;}
  .tog-on .tog-knob{left:21px;}
  .tog-off .tog-knob{left:3px;}
  .hr-time-input{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:7px 12px;font-size:14px;color:#fff9e6;font-family:monospace;outline:none;transition:border-color .2s;width:110px;}
  .hr-time-input:focus{border-color:rgba(194,144,77,.4);}
  .hr-ate{font-size:13px;color:#4a3e30;}
  .hr-del-btn{background:none;border:none;cursor:pointer;font-size:15px;opacity:.5;transition:opacity .15s;padding:4px;}
  .hr-del-btn:hover{opacity:1;}
  .hr-footer-mobile{display:none;}
  @media(max-width:600px){
    .hr-root{padding:16px;}
    .hr-header{flex-direction:column;}
    .hr-footer-mobile{display:flex;justify-content:center;padding-top:8px;}
    .hr-footer-mobile .hr-salvar-btn{width:100%;}
  }
`

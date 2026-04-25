'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

type Lead = {
  id: string
  nome: string
  whatsapp: string | null
  email: string | null
  status_lead: string
  nivel_qs: string | null
  pilar_fraco: string | null
  qs_total: number | null
  renda_mensal: string | null
  criado_em: string
  etiqueta: string | null
  origem: string | null
}

type Agente = { id: string; nome: string; nome_persona: string | null }

interface Props {
  leads: Lead[]
  agentes: Agente[]
}

const STATUS_COLOR: Record<string, string> = { quente: '#e07070', morno: '#d4a055', frio: '#7a9ec0' }
const STATUS_EMOJI: Record<string, string> = { quente: '🔴', morno: '🟡', frio: '🔵' }

function etiquetaLabel(e: string | null) {
  if (!e || e === 'ia_atendendo') return 'IA'
  if (e === 'humano_atendendo') return 'Humano'
  return e
}
function etiquetaCor(e: string | null) {
  if (!e || e === 'ia_atendendo') return '#5b9bd5'
  if (e === 'humano_atendendo') return '#7ac47a'
  return '#c2904d'
}

export default function LeadsTabela({ leads, agentes }: Props) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [modalAberto, setModalAberto] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [canal, setCanal] = useState<'baileys' | 'meta'>('baileys')
  const [agenteId, setAgenteId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ enviados: number; falhas: number } | null>(null)

  const leadsComWpp = leads.filter(l => l.whatsapp)

  const toggleLead = useCallback((id: string, temWpp: boolean) => {
    if (!temWpp) return
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleTodos = useCallback(() => {
    if (selecionados.size === leadsComWpp.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(leadsComWpp.map(l => l.id)))
    }
  }, [selecionados.size, leadsComWpp])

  const abrirModal = () => {
    if (selecionados.size === 0) return
    setResultado(null)
    setMensagem('')
    setModalAberto(true)
  }

  const enviar = async () => {
    if (!mensagem.trim() || selecionados.size === 0) return
    setEnviando(true)
    try {
      const res = await fetch('/api/admin/leads/reengajar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_ids: [...selecionados],
          mensagem: mensagem.trim(),
          canal,
          agente_id: agenteId || undefined,
          delay_ms: 2500,
        }),
      })
      const data = await res.json() as { enviados: number; falhas: number }
      setResultado(data)
      setSelecionados(new Set())
    } catch {
      setResultado({ enviados: 0, falhas: selecionados.size })
    } finally {
      setEnviando(false)
    }
  }

  const todosSelected = leadsComWpp.length > 0 && selecionados.size === leadsComWpp.length

  return (
    <>
      <style>{css}</style>

      {/* Barra de reengajamento */}
      <div className="reeng-bar">
        <label className="reeng-check-all" onClick={toggleTodos}>
          <span className={`reeng-fake-check ${todosSelected ? 'checked' : ''}`} />
          <span>{selecionados.size === 0 ? 'Selecionar todos' : `${selecionados.size} selecionado(s)`}</span>
        </label>
        {selecionados.size > 0 && (
          <button className="reeng-btn" onClick={abrirModal}>
            📨 Reengajar {selecionados.size} lead(s)
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="leads-table-wrap">
        <table className="leads-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Nome</th>
              <th>WhatsApp</th>
              <th>Origem</th>
              <th>Etiqueta</th>
              <th>QS</th>
              <th>Nível</th>
              <th>Status</th>
              <th>Cadastro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads && leads.length > 0 ? leads.map(lead => (
              <tr
                key={lead.id}
                className={selecionados.has(lead.id) ? 'row-selected' : ''}
                onClick={() => toggleLead(lead.id, !!lead.whatsapp)}
              >
                <td className="td-check" onClick={e => e.stopPropagation()}>
                  {lead.whatsapp ? (
                    <span
                      className={`reeng-fake-check ${selecionados.has(lead.id) ? 'checked' : ''}`}
                      onClick={() => toggleLead(lead.id, true)}
                    />
                  ) : (
                    <span className="td-dash" title="Sem WhatsApp">—</span>
                  )}
                </td>
                <td className="td-nome">
                  <span className="lead-avatar">{lead.nome.charAt(0).toUpperCase()}</span>
                  <span>{lead.nome}</span>
                </td>
                <td className="td-muted">{lead.whatsapp}</td>
                <td className="td-origem">{lead.origem ?? <span className="td-dash">—</span>}</td>
                <td>
                  <span
                    className="etiqueta-badge"
                    style={{ color: etiquetaCor(lead.etiqueta), borderColor: etiquetaCor(lead.etiqueta) + '33' }}
                  >
                    {etiquetaLabel(lead.etiqueta)}
                  </span>
                </td>
                <td className="td-qs">{lead.qs_total ?? '—'}</td>
                <td className="td-muted">{lead.nivel_qs ?? '—'}</td>
                <td>
                  <span className="status-badge" style={{ color: STATUS_COLOR[lead.status_lead] }}>
                    {STATUS_EMOJI[lead.status_lead]} {lead.status_lead}
                  </span>
                </td>
                <td className="td-muted">{new Date(lead.criado_em).toLocaleDateString('pt-BR')}</td>
                <td onClick={e => e.stopPropagation()}>
                  <Link className="lead-link" href={`/dashboard/leads/${lead.id}`}>Ver →</Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={10} className="td-empty">Nenhum lead encontrado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de reengajamento */}
      {modalAberto && (
        <div className="reeng-overlay" onClick={e => { if (e.target === e.currentTarget) setModalAberto(false) }}>
          <div className="reeng-modal">
            <div className="reeng-modal-header">
              <h2>Reengajamento em massa</h2>
              <button className="reeng-close" onClick={() => setModalAberto(false)}>✕</button>
            </div>

            {resultado ? (
              <div className="reeng-resultado">
                <div className="reeng-num" style={{ color: resultado.enviados > 0 ? '#7ac47a' : '#e07070' }}>
                  {resultado.enviados}
                </div>
                <div className="reeng-num-label">mensagem(ns) enviada(s)</div>
                {resultado.falhas > 0 && (
                  <div className="reeng-falha">{resultado.falhas} falha(s) — verifique o canal</div>
                )}
                <p className="reeng-info-ok">
                  Quando os leads responderem, o agente continuará a conversa automaticamente.
                </p>
                <button className="reeng-send-btn" onClick={() => setModalAberto(false)}>Fechar</button>
              </div>
            ) : (
              <>
                <div className="reeng-desc">
                  Enviando para <strong>{selecionados.size}</strong> lead(s) com intervalo de 2,5s entre envios.
                  {selecionados.size > 30 && (
                    <span className="reeng-warn"> Recomendamos no máximo 30 por vez.</span>
                  )}
                </div>

                <label className="reeng-label">Mensagem</label>
                <textarea
                  className="reeng-textarea"
                  rows={5}
                  placeholder={'Olá {nome}, tudo bem?\n\nTenho uma novidade especial para você…'}
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                />
                <p className="reeng-hint">Use {'{nome}'} para personalizar com o primeiro nome do lead.</p>

                <div className="reeng-row">
                  <div className="reeng-field">
                    <label className="reeng-label">Canal de envio</label>
                    <select className="reeng-select" value={canal} onChange={e => setCanal(e.target.value as 'baileys' | 'meta')}>
                      <option value="baileys">Baileys (WhatsApp pessoal)</option>
                      <option value="meta">Meta (WhatsApp Business)</option>
                    </select>
                  </div>
                  <div className="reeng-field">
                    <label className="reeng-label">Agente que continuará</label>
                    <select className="reeng-select" value={agenteId} onChange={e => setAgenteId(e.target.value)}>
                      <option value="">Manter agente atual</option>
                      {agentes.map(a => (
                        <option key={a.id} value={a.id}>{a.nome_persona || a.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  className="reeng-send-btn"
                  onClick={enviar}
                  disabled={enviando || !mensagem.trim()}
                >
                  {enviando
                    ? `Enviando… (~${Math.ceil(selecionados.size * 2.5 / 60)}min)`
                    : `Enviar para ${selecionados.size} lead(s)`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const css = `
  .reeng-bar{display:flex;align-items:center;gap:16px;margin-bottom:16px;padding:10px 16px;background:#111009;border:1px solid #2a1f18;border-radius:12px;}
  .reeng-check-all{display:flex;align-items:center;gap:9px;font-size:13px;color:#7a6e5e;cursor:pointer;user-select:none;}
  .reeng-btn{margin-left:auto;background:#c2904d;color:#0e0f09;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .15s;}
  .reeng-btn:hover{filter:brightness(1.1);}
  .reeng-fake-check{display:inline-block;width:16px;height:16px;border:2px solid #4a3e30;border-radius:4px;background:#111009;flex-shrink:0;cursor:pointer;transition:all .15s;position:relative;}
  .reeng-fake-check.checked{background:#c2904d;border-color:#c2904d;}
  .reeng-fake-check.checked::after{content:'✓';position:absolute;top:-2px;left:1px;font-size:12px;color:#0e0f09;font-weight:700;}
  .td-check{width:40px;text-align:center;cursor:pointer;}

  .leads-table-wrap{overflow-x:auto;border-radius:16px;border:1px solid #2a1f18;}
  .leads-table{width:100%;border-collapse:collapse;font-size:14px;}
  .leads-table th{background:#111009;padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#4a3e30;border-bottom:1px solid #2a1f18;white-space:nowrap;}
  .leads-table td{padding:14px 16px;border-bottom:1px solid rgba(42,31,24,.5);}
  .leads-table tr:last-child td{border-bottom:none;}
  .leads-table tr:hover td{background:rgba(255,255,255,.015);}
  .leads-table tr.row-selected td{background:rgba(194,144,77,.06);}
  .leads-table tbody tr{cursor:pointer;}
  .td-nome{display:flex;align-items:center;gap:10px;}
  .lead-avatar{width:32px;height:32px;border-radius:50%;background:rgba(194,144,77,.15);border:1px solid rgba(194,144,77,.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#c2904d;flex-shrink:0;}
  .td-muted{color:#7a6e5e;}
  .td-origem{font-size:12px;color:#9b8ec4;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .td-dash{color:#4a3e30;}
  .td-qs{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:700;color:#c2904d;}
  .status-badge{font-size:12px;font-weight:600;letter-spacing:.3px;text-transform:capitalize;}
  .etiqueta-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:3px 8px;border-radius:6px;border:1px solid;background:transparent;}
  .td-empty{text-align:center;padding:48px 16px;color:#4a3e30;font-style:italic;}
  .lead-link{font-size:13px;color:#c2904d;text-decoration:none;font-weight:600;opacity:.7;transition:opacity .15s;}
  .lead-link:hover{opacity:1;}

  .reeng-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;}
  .reeng-modal{background:#1a1410;border:1px solid #2a1f18;border-radius:20px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;padding:32px;}
  .reeng-modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;}
  .reeng-modal-header h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:700;color:#fff9e6;margin:0;}
  .reeng-close{background:none;border:none;color:#7a6e5e;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:color .15s;}
  .reeng-close:hover{color:#fff9e6;}
  .reeng-desc{font-size:13px;color:#7a6e5e;margin-bottom:20px;line-height:1.5;}
  .reeng-warn{color:#d4a055;font-weight:600;}
  .reeng-label{display:block;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a3e30;margin-bottom:8px;}
  .reeng-textarea{width:100%;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:12px 14px;font-size:14px;color:#fff9e6;font-family:inherit;resize:vertical;outline:none;box-sizing:border-box;transition:border-color .2s;}
  .reeng-textarea:focus{border-color:rgba(194,144,77,.4);}
  .reeng-hint{font-size:11px;color:#4a3e30;margin:6px 0 20px;}
  .reeng-row{display:flex;gap:16px;margin-bottom:24px;}
  .reeng-field{flex:1;}
  .reeng-select{width:100%;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:9px 14px;font-size:13px;color:#fff9e6;font-family:inherit;outline:none;appearance:none;cursor:pointer;transition:border-color .2s;}
  .reeng-select:focus{border-color:rgba(194,144,77,.4);}
  .reeng-send-btn{width:100%;background:#c2904d;color:#0e0f09;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .15s;margin-top:4px;}
  .reeng-send-btn:hover:not(:disabled){filter:brightness(1.08);}
  .reeng-send-btn:disabled{opacity:.5;cursor:not-allowed;}
  .reeng-resultado{text-align:center;padding:16px 0;}
  .reeng-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:64px;font-weight:700;line-height:1;}
  .reeng-num-label{font-size:15px;color:#7a6e5e;margin:6px 0 8px;}
  .reeng-falha{font-size:13px;color:#e07070;margin-bottom:12px;}
  .reeng-info-ok{font-size:13px;color:#7a6e5e;margin-bottom:24px;line-height:1.6;}
`

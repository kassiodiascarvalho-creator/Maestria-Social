'use client'

import { useState, useEffect, useCallback } from 'react'

type Conversa = {
  id: string
  lead_id: string | null
  campanha_id: string | null
  email_lead: string
  nome_lead: string | null
  assunto: string
  status: 'aguardando' | 'respondido' | 'fechado'
  total_mensagens: number
  nao_lidas: number
  ultima_mensagem_em: string
  criado_em: string
  leads?: { nome: string | null; telefone: string | null }
  email_campanhas?: { nome: string }
}

type Mensagem = {
  id: string
  conversa_id: string
  direcao: 'entrada' | 'saida'
  de: string
  corpo_html: string | null
  corpo_texto: string | null
  lida: boolean
  criado_em: string
}

const STATUS_LABEL: Record<string, string> = { aguardando: 'Aguardando', respondido: 'Respondido', fechado: 'Fechado' }
const STATUS_COR: Record<string, string> = { aguardando: '#f59e0b', respondido: '#10b981', fechado: '#4a3e30' }

function tempo(iso: string) {
  const d = new Date(iso)
  const agora = new Date()
  const diff = Math.floor((agora.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function EmailInboxTab() {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [ativa, setAtiva] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const url = filtro ? `/api/admin/emails/inbox?status=${filtro}` : '/api/admin/emails/inbox'
    const res = await fetch(url)
    if (res.ok) { const d = await res.json(); setConversas(d.conversas || []) }
    setLoading(false)
  }, [filtro])

  useEffect(() => { carregar() }, [carregar])

  async function abrirConversa(c: Conversa) {
    setAtiva(c); setLoadingThread(true); setMsg(null); setResposta('')
    const res = await fetch(`/api/admin/emails/inbox/${c.id}`)
    if (res.ok) {
      const d = await res.json()
      setMensagens(d.mensagens || [])
      // atualiza nao_lidas localmente
      setConversas(prev => prev.map(x => x.id === c.id ? { ...x, nao_lidas: 0 } : x))
    }
    setLoadingThread(false)
  }

  async function fecharConversa(id: string) {
    await fetch(`/api/admin/emails/inbox/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fechado' }),
    })
    setConversas(prev => prev.map(c => c.id === id ? { ...c, status: 'fechado' } : c))
    if (ativa?.id === id) setAtiva(a => a ? { ...a, status: 'fechado' } : null)
  }

  async function enviarResposta() {
    if (!ativa || !resposta.trim()) return
    setEnviando(true); setMsg(null)
    const res = await fetch(`/api/admin/emails/inbox/${ativa.id}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corpo_texto: resposta }),
    })
    if (res.ok) {
      const novaMsg: Mensagem = {
        id: crypto.randomUUID(),
        conversa_id: ativa.id,
        direcao: 'saida',
        de: 'time@maestriasocial.com',
        corpo_html: null,
        corpo_texto: resposta,
        lida: true,
        criado_em: new Date().toISOString(),
      }
      setMensagens(prev => [...prev, novaMsg])
      setConversas(prev => prev.map(c =>
        c.id === ativa.id
          ? { ...c, status: 'aguardando', total_mensagens: c.total_mensagens + 1, ultima_mensagem_em: new Date().toISOString() }
          : c
      ))
      setAtiva(a => a ? { ...a, status: 'aguardando' } : null)
      setResposta('')
      setMsg('✅ Resposta enviada')
    } else {
      const d = await res.json()
      setMsg(`❌ ${d.error || 'Erro ao enviar'}`)
    }
    setEnviando(false)
  }

  const totalNaoLidas = conversas.reduce((s, c) => s + (c.nao_lidas || 0), 0)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: 500, gap: 0, border: '1px solid #2a1f18', borderRadius: 16, overflow: 'hidden' }}>

      {/* ── PAINEL ESQUERDO: lista de conversas ── */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #2a1f18', display: 'flex', flexDirection: 'column', background: '#111009' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a1f18' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#fff9e6', fontWeight: 800, fontSize: 15 }}>Inbox</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {totalNaoLidas > 0 && (
                <span style={{ background: '#c2904d', color: '#0e0f09', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '2px 8px' }}>{totalNaoLidas}</span>
              )}
              <button onClick={carregar} style={{ background: 'transparent', border: 'none', color: '#4a3e30', cursor: 'pointer', fontSize: 16 }} title='Atualizar'>↺</button>
            </div>
          </div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[['', 'Todos'], ['respondido', 'Com resposta'], ['aguardando', 'Aguardando'], ['fechado', 'Fechado']].map(([v, l]) => (
              <button key={v} onClick={() => setFiltro(v)}
                style={{ flex: 1, padding: '5px 4px', fontSize: 10, fontWeight: 700, border: '1px solid', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  background: filtro === v ? 'rgba(194,144,77,.12)' : 'transparent',
                  borderColor: filtro === v ? 'rgba(194,144,77,.3)' : '#2a1f18',
                  color: filtro === v ? '#c2904d' : '#4a3e30',
                }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p style={{ color: '#4a3e30', padding: 16, fontSize: 13 }}>Carregando...</p>}
          {!loading && conversas.length === 0 && (
            <p style={{ color: '#4a3e30', padding: 16, fontSize: 13 }}>Nenhuma conversa{filtro ? ' nesse filtro' : ''}.</p>
          )}
          {conversas.map(c => (
            <div key={c.id} onClick={() => abrirConversa(c)}
              style={{ padding: '12px 14px', borderBottom: '1px solid #1a1410', cursor: 'pointer', transition: 'background .15s',
                background: ativa?.id === c.id ? 'rgba(194,144,77,.08)' : c.nao_lidas > 0 ? 'rgba(16,185,129,.04)' : 'transparent',
                borderLeft: ativa?.id === c.id ? '3px solid #c2904d' : '3px solid transparent',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ color: c.nao_lidas > 0 ? '#fff9e6' : '#c8b99a', fontWeight: c.nao_lidas > 0 ? 700 : 500, fontSize: 13, flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.leads?.nome || c.nome_lead || c.email_lead}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {c.nao_lidas > 0 && (
                    <span style={{ background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{c.nao_lidas}</span>
                  )}
                  <span style={{ color: '#4a3e30', fontSize: 10 }}>{tempo(c.ultima_mensagem_em)}</span>
                </div>
              </div>
              <div style={{ color: '#7a6e5e', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{c.assunto}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: STATUS_COR[c.status], fontWeight: 700 }}>● {STATUS_LABEL[c.status]}</span>
                <span style={{ fontSize: 10, color: '#2a1f18' }}>·</span>
                <span style={{ fontSize: 10, color: '#4a3e30' }}>{c.total_mensagens} msg{c.total_mensagens !== 1 ? 's' : ''}</span>
                {c.email_campanhas?.nome && (
                  <>
                    <span style={{ fontSize: 10, color: '#2a1f18' }}>·</span>
                    <span style={{ fontSize: 10, color: '#4a3e30', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{c.email_campanhas.nome}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PAINEL DIREITO: thread + resposta ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0e0f09' }}>
        {!ativa ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✉</div>
              <p style={{ color: '#4a3e30', fontSize: 14 }}>Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #2a1f18', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff9e6', fontWeight: 700, fontSize: 15 }}>{ativa.leads?.nome || ativa.nome_lead || ativa.email_lead}</div>
                <div style={{ color: '#4a3e30', fontSize: 12, marginTop: 2 }}>{ativa.email_lead} · {ativa.assunto}</div>
              </div>
              <span style={{ fontSize: 11, color: STATUS_COR[ativa.status], fontWeight: 700, border: `1px solid ${STATUS_COR[ativa.status]}40`, borderRadius: 20, padding: '3px 10px' }}>
                {STATUS_LABEL[ativa.status]}
              </span>
              {ativa.status !== 'fechado' && (
                <button onClick={() => fecharConversa(ativa.id)}
                  style={{ background: 'transparent', border: '1px solid #2a1f18', borderRadius: 8, padding: '5px 12px', color: '#4a3e30', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Fechar
                </button>
              )}
            </div>

            {/* Thread de mensagens */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadingThread && <p style={{ color: '#4a3e30', fontSize: 13 }}>Carregando mensagens...</p>}
              {mensagens.map(m => (
                <div key={m.id} style={{ display: 'flex', flexDirection: m.direcao === 'saida' ? 'row-reverse' : 'row', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    background: m.direcao === 'saida' ? 'rgba(194,144,77,.15)' : 'rgba(99,102,241,.15)',
                    color: m.direcao === 'saida' ? '#c2904d' : '#818cf8',
                  }}>
                    {m.direcao === 'saida' ? '◎' : '◉'}
                  </div>
                  <div style={{ maxWidth: '75%' }}>
                    <div style={{ fontSize: 10, color: '#4a3e30', marginBottom: 4, textAlign: m.direcao === 'saida' ? 'right' : 'left' }}>
                      {m.direcao === 'saida' ? 'Você' : (ativa.leads?.nome || ativa.nome_lead || ativa.email_lead)} · {tempo(m.criado_em)}
                    </div>
                    <div style={{
                      background: m.direcao === 'saida' ? 'rgba(194,144,77,.08)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${m.direcao === 'saida' ? 'rgba(194,144,77,.2)' : '#2a1f18'}`,
                      borderRadius: m.direcao === 'saida' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#cdbfa8',
                      lineHeight: 1.6,
                    }}>
                      {m.corpo_html
                        ? <div dangerouslySetInnerHTML={{ __html: m.corpo_html }} style={{ maxHeight: 300, overflow: 'auto' }} />
                        : <span style={{ whiteSpace: 'pre-wrap' }}>{m.corpo_texto}</span>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Box de resposta */}
            {ativa.status !== 'fechado' && (
              <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #2a1f18' }}>
                {msg && (
                  <div style={{ marginBottom: 8, fontSize: 12, color: msg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{msg}</div>
                )}
                <textarea
                  value={resposta}
                  onChange={e => setResposta(e.target.value)}
                  placeholder={`Responder para ${ativa.email_lead}...`}
                  rows={3}
                  style={{ width: '100%', background: '#13100c', border: '1px solid #2a1f18', borderRadius: 10, padding: '10px 12px', color: '#cdbfa8', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(194,144,77,.35)' }}
                  onBlur={e => { e.target.style.borderColor = '#2a1f18' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={enviarResposta} disabled={enviando || !resposta.trim()}
                    style={{ background: 'linear-gradient(135deg,#c2904d,#d4a055)', color: '#0e0f09', border: 'none', borderRadius: 10, padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (enviando || !resposta.trim()) ? 0.4 : 1 }}>
                    {enviando ? 'Enviando...' : 'Enviar ↑'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

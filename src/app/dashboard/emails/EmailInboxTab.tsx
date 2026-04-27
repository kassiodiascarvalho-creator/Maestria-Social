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

type Stats = { total: number; respondidas: number; taxaResposta: string }

const STATUS_LABEL: Record<string, string> = { aguardando: 'Aguardando', respondido: 'Respondido', fechado: 'Fechado' }
const STATUS_COR: Record<string, string>   = { aguardando: '#f59e0b',    respondido: '#10b981',      fechado: '#4a3e30' }

const SQL_SETUP = `-- Cole no SQL Editor do Supabase e execute
CREATE TABLE IF NOT EXISTS conversas_email (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            uuid REFERENCES leads(id) ON DELETE SET NULL,
  campanha_id        uuid REFERENCES email_campanhas(id) ON DELETE SET NULL,
  email_lead         text NOT NULL,
  nome_lead          text,
  assunto            text NOT NULL,
  status             text DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'respondido', 'fechado')),
  total_mensagens    int DEFAULT 1,
  nao_lidas          int DEFAULT 0,
  ultima_mensagem_em timestamptz DEFAULT now(),
  criado_em          timestamptz DEFAULT now(),
  UNIQUE (campanha_id, email_lead)
);
CREATE TABLE IF NOT EXISTS mensagens_email (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id       uuid NOT NULL REFERENCES conversas_email(id) ON DELETE CASCADE,
  direcao           text NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  de                text NOT NULL,
  corpo_html        text,
  corpo_texto       text,
  lida              boolean DEFAULT true,
  resend_message_id text,
  criado_em         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversas_email_lead    ON conversas_email(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversas_email_status  ON conversas_email(status);
CREATE INDEX IF NOT EXISTS idx_conversas_email_ultima  ON conversas_email(ultima_mensagem_em DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_email_conversa ON mensagens_email(conversa_id);`

function tempo(iso: string) {
  const d    = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function EmailInboxTab() {
  const [conversas,     setConversas]     = useState<Conversa[]>([])
  const [stats,         setStats]         = useState<Stats | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [setupNeeded,   setSetupNeeded]   = useState(false)
  const [sqlCopiado,    setSqlCopiado]    = useState(false)
  const [filtro,        setFiltro]        = useState('')
  const [ativa,         setAtiva]         = useState<Conversa | null>(null)
  const [mensagens,     setMensagens]     = useState<Mensagem[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [resposta,      setResposta]      = useState('')
  const [enviando,      setEnviando]      = useState(false)
  const [msg,           setMsg]           = useState<string | null>(null)
  const [importando,    setImportando]    = useState(false)
  const [msgImport,     setMsgImport]     = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const url = filtro ? `/api/admin/emails/inbox?status=${filtro}` : '/api/admin/emails/inbox'
    const res  = await fetch(url)
    const d    = await res.json()

    if (d.error === 'SETUP_NEEDED') {
      setSetupNeeded(true)
      setConversas([])
    } else {
      setSetupNeeded(false)
      setConversas(d.conversas || [])
      if (d.stats) setStats(d.stats)
    }
    setLoading(false)
  }, [filtro])

  useEffect(() => { carregar() }, [carregar])

  async function abrirConversa(c: Conversa) {
    setAtiva(c); setLoadingThread(true); setMsg(null); setResposta('')
    const res = await fetch(`/api/admin/emails/inbox/${c.id}`)
    if (res.ok) {
      const d = await res.json()
      setMensagens(d.mensagens || [])
      setConversas(prev => prev.map(x => x.id === c.id ? { ...x, nao_lidas: 0 } : x))
      setStats(prev => prev && c.nao_lidas > 0 ? prev : prev)
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
      setMensagens(prev => [...prev, {
        id: crypto.randomUUID(), conversa_id: ativa.id, direcao: 'saida',
        de: 'time@maestriasocial.com', corpo_html: null, corpo_texto: resposta,
        lida: true, criado_em: new Date().toISOString(),
      }])
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

  async function importarHistorico() {
    setImportando(true); setMsgImport(null)
    const res = await fetch('/api/admin/emails/inbox/backfill', { method: 'POST' })
    const d   = await res.json()
    if (res.ok) {
      setMsgImport(`✅ ${d.importados} conversas importadas (${d.total} e-mails no histórico)`)
      carregar()
    } else {
      setMsgImport(`❌ ${d.error}`)
    }
    setImportando(false)
  }

  function copiarSQL() {
    navigator.clipboard.writeText(SQL_SETUP).then(() => {
      setSqlCopiado(true)
      setTimeout(() => setSqlCopiado(false), 2500)
    })
  }

  const totalNaoLidas = conversas.reduce((s, c) => s + (c.nao_lidas || 0), 0)

  // ── SETUP NECESSÁRIO ───────────────────────────────────────────
  if (setupNeeded) {
    return (
      <div style={{ padding: 32, background: '#1a1410', border: '1px solid #2a1f18', borderRadius: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff9e6', marginBottom: 8 }}>⚠ Configuração necessária</div>
        <p style={{ color: '#7a6e5e', fontSize: 14, marginBottom: 20 }}>
          As tabelas do Inbox ainda não foram criadas no Supabase. Copie o SQL abaixo e rode no{' '}
          <strong style={{ color: '#c2904d' }}>SQL Editor do Supabase</strong>, depois volte aqui e atualize.
        </p>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <pre style={{ background: '#0e0f09', border: '1px solid #2a1f18', borderRadius: 10, padding: 16, fontSize: 11, color: '#7a9ec0', overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {SQL_SETUP}
          </pre>
          <button onClick={copiarSQL}
            style={{ position: 'absolute', top: 10, right: 10, background: sqlCopiado ? 'rgba(16,185,129,.15)' : 'rgba(194,144,77,.1)', border: `1px solid ${sqlCopiado ? 'rgba(16,185,129,.3)' : 'rgba(194,144,77,.25)'}`, borderRadius: 8, padding: '5px 14px', color: sqlCopiado ? '#10b981' : '#c2904d', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {sqlCopiado ? '✓ Copiado!' : 'Copiar SQL'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href='https://supabase.com/dashboard/project/dhudmbbgdyxdxypixyis/sql' target='_blank' rel='noreferrer'
            style={{ display: 'inline-block', padding: '10px 20px', background: 'linear-gradient(135deg,#c2904d,#d4a055)', color: '#0e0f09', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Abrir SQL Editor ↗
          </a>
          <button onClick={carregar}
            style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2a1f18', borderRadius: 10, color: '#7a6e5e', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↺ Verificar novamente
          </button>
        </div>
      </div>
    )
  }

  // ── INBOX PRINCIPAL ────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Stats bar ── */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total conversas', val: stats.total,         cor: '#c2904d' },
            { label: 'Respondidas',     val: stats.respondidas,   cor: '#10b981' },
            { label: 'Taxa de resposta', val: `${stats.taxaResposta}%`, cor: '#6366f1' },
          ].map(({ label, val, cor }) => (
            <div key={label} style={{ background: '#1a1410', border: '1px solid #2a1f18', borderRadius: 10, padding: '12px 18px', minWidth: 120 }}>
              <div style={{ fontSize: 10, color: '#4a3e30', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: cor }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Backfill banner ── */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={importarHistorico} disabled={importando}
          style={{ padding: '7px 16px', background: 'rgba(194,144,77,.08)', border: '1px solid rgba(194,144,77,.2)', borderRadius: 8, color: '#c2904d', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: importando ? 0.6 : 1 }}>
          {importando ? '⏳ Importando...' : '⬇ Importar histórico de envios'}
        </button>
        {msgImport && <span style={{ fontSize: 12, color: msgImport.startsWith('✅') ? '#10b981' : '#ef4444' }}>{msgImport}</span>}
      </div>

      {/* ── Painel dual ── */}
      <div style={{ display: 'flex', height: 'calc(100vh - 320px)', minHeight: 480, gap: 0, border: '1px solid #2a1f18', borderRadius: 16, overflow: 'hidden' }}>

        {/* ── Lista de conversas ── */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid #2a1f18', display: 'flex', flexDirection: 'column', background: '#111009' }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #2a1f18' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#fff9e6', fontWeight: 800, fontSize: 14 }}>Inbox</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {totalNaoLidas > 0 && (
                  <span style={{ background: '#10b981', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '2px 8px' }}>{totalNaoLidas} nova{totalNaoLidas !== 1 ? 's' : ''}</span>
                )}
                <button onClick={carregar} title='Atualizar' style={{ background: 'transparent', border: 'none', color: '#4a3e30', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>↺</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {([['', 'Todos'], ['respondido', 'Resp.'], ['aguardando', 'Aguard.'], ['fechado', 'Fechado']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFiltro(v)}
                  style={{ flex: 1, padding: '5px 2px', fontSize: 10, fontWeight: 700, border: '1px solid', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                    background:     filtro === v ? 'rgba(194,144,77,.12)' : 'transparent',
                    borderColor:    filtro === v ? 'rgba(194,144,77,.3)'  : '#2a1f18',
                    color:          filtro === v ? '#c2904d'              : '#4a3e30',
                  }}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <p style={{ color: '#4a3e30', padding: 16, fontSize: 13 }}>Carregando...</p>}
            {!loading && conversas.length === 0 && (
              <p style={{ color: '#4a3e30', padding: 16, fontSize: 13 }}>Nenhuma conversa{filtro ? ' neste filtro' : ''}.<br /><span style={{ fontSize: 11 }}>Use o botão acima para importar histórico.</span></p>
            )}
            {conversas.map(c => (
              <div key={c.id} onClick={() => abrirConversa(c)}
                style={{ padding: '11px 13px', borderBottom: '1px solid #1a1410', cursor: 'pointer',
                  background:  ativa?.id === c.id ? 'rgba(194,144,77,.08)' : c.nao_lidas > 0 ? 'rgba(16,185,129,.04)' : 'transparent',
                  borderLeft:  ativa?.id === c.id ? '3px solid #c2904d'    : '3px solid transparent',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                  <span style={{ color: c.nao_lidas > 0 ? '#fff9e6' : '#c8b99a', fontWeight: c.nao_lidas > 0 ? 700 : 500, fontSize: 13, flex: 1, marginRight: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.leads?.nome || c.nome_lead || c.email_lead}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {c.nao_lidas > 0 && (
                      <span style={{ background: '#10b981', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 20, padding: '1px 5px' }}>{c.nao_lidas}</span>
                    )}
                    <span style={{ color: '#4a3e30', fontSize: 10 }}>{tempo(c.ultima_mensagem_em)}</span>
                  </div>
                </div>
                <div style={{ color: '#7a6e5e', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{c.assunto}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10, color: STATUS_COR[c.status], fontWeight: 700 }}>● {STATUS_LABEL[c.status]}</span>
                  <span style={{ fontSize: 10, color: '#2a1f18' }}>·</span>
                  <span style={{ fontSize: 10, color: '#4a3e30' }}>{c.total_mensagens} msg</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Thread + resposta ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0e0f09', minWidth: 0 }}>
          {!ativa ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 36 }}>✉</div>
              <p style={{ color: '#4a3e30', fontSize: 13 }}>Selecione uma conversa para ver o histórico</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho */}
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #2a1f18', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff9e6', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ativa.leads?.nome || ativa.nome_lead || ativa.email_lead}
                  </div>
                  <div style={{ color: '#4a3e30', fontSize: 11, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ativa.email_lead}{ativa.email_campanhas?.nome ? ` · ${ativa.email_campanhas.nome}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: STATUS_COR[ativa.status], fontWeight: 700, border: `1px solid ${STATUS_COR[ativa.status]}40`, borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
                  {STATUS_LABEL[ativa.status]}
                </span>
                {ativa.status !== 'fechado' && (
                  <button onClick={() => fecharConversa(ativa.id)}
                    style={{ background: 'transparent', border: '1px solid #2a1f18', borderRadius: 8, padding: '4px 10px', color: '#4a3e30', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    Fechar
                  </button>
                )}
              </div>

              {/* Mensagens */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadingThread && <p style={{ color: '#4a3e30', fontSize: 13 }}>Carregando...</p>}
                {mensagens.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: m.direcao === 'saida' ? 'row-reverse' : 'row', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                      background: m.direcao === 'saida' ? 'rgba(194,144,77,.15)' : 'rgba(99,102,241,.15)',
                      color:      m.direcao === 'saida' ? '#c2904d'              : '#818cf8',
                    }}>
                      {m.direcao === 'saida' ? '◎' : '◉'}
                    </div>
                    <div style={{ maxWidth: '73%' }}>
                      <div style={{ fontSize: 10, color: '#4a3e30', marginBottom: 3, textAlign: m.direcao === 'saida' ? 'right' : 'left' }}>
                        {m.direcao === 'saida' ? 'Você' : (ativa.leads?.nome || ativa.nome_lead || ativa.email_lead)} · {tempo(m.criado_em)}
                      </div>
                      <div style={{
                        background:   m.direcao === 'saida' ? 'rgba(194,144,77,.08)' : 'rgba(255,255,255,.04)',
                        border:       `1px solid ${m.direcao === 'saida' ? 'rgba(194,144,77,.2)' : '#2a1f18'}`,
                        borderRadius: m.direcao === 'saida' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                        padding: '9px 13px', fontSize: 13, color: '#cdbfa8', lineHeight: 1.6,
                      }}>
                        {m.corpo_html
                          ? <div dangerouslySetInnerHTML={{ __html: m.corpo_html }} style={{ maxHeight: 280, overflow: 'auto' }} />
                          : <span style={{ whiteSpace: 'pre-wrap' }}>{m.corpo_texto}</span>
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Caixa de resposta */}
              {ativa.status !== 'fechado' && (
                <div style={{ padding: '10px 18px 14px', borderTop: '1px solid #2a1f18' }}>
                  {msg && <div style={{ marginBottom: 6, fontSize: 12, color: msg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{msg}</div>}
                  <textarea value={resposta} onChange={e => setResposta(e.target.value)}
                    placeholder={`Responder para ${ativa.email_lead}...`} rows={3}
                    style={{ width: '100%', background: '#13100c', border: '1px solid #2a1f18', borderRadius: 10, padding: '9px 12px', color: '#cdbfa8', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(194,144,77,.35)' }}
                    onBlur={e  => { e.target.style.borderColor = '#2a1f18' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 7 }}>
                    <button onClick={enviarResposta} disabled={enviando || !resposta.trim()}
                      style={{ background: 'linear-gradient(135deg,#c2904d,#d4a055)', color: '#0e0f09', border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (enviando || !resposta.trim()) ? 0.4 : 1 }}>
                      {enviando ? 'Enviando...' : 'Enviar ↑'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

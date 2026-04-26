'use client'

import { useState, useRef, useCallback } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────
type Template = { id: string; pilar: string; dia: number; assunto: string; corpo_html: string; ativo: boolean; atualizado_em: string }
type Lista = { id: string; nome: string; descricao?: string; tags: string[]; total_contatos: number; criado_em: string }
type Campanha = { id: string; nome: string; assunto_a: string; assunto_b?: string; remetente_nome: string; remetente_email: string; lista_id?: string; status: string; total_enviados: number; total_abertos: number; total_cliques: number; total_bounced: number; criado_em: string; email_listas?: { nome: string } }

const PILARES = ['Sociabilidade', 'Comunicação', 'Relacionamento', 'Persuasão', 'Influência'] as const
const DIAS = [0, 1, 3, 5, 7] as const
const LABEL_DIA: Record<number, string> = { 0: 'D+0 (imediato)', 1: 'D+1', 3: 'D+3', 5: 'D+5', 7: 'D+7' }
const NIVEIS = ['Negligente', 'Iniciante', 'Intermediário', 'Avançado', 'Mestre']
const STATUS_LEAD = ['frio', 'morno', 'quente']
const STATUS_COR: Record<string, string> = { rascunho: '#666', agendado: '#6366f1', enviando: '#f59e0b', enviado: '#10b981', pausado: '#ef4444', cancelado: '#999' }

// ── Helpers ───────────────────────────────────────────────────────
function Stat({ label, value, cor }: { label: string; value: string | number; cor?: string }) {
  return (
    <div style={{ background: '#1a1410', border: '1px solid #2a1f18', borderRadius: 10, padding: '16px 20px', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: '#4a3e30', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: cor || '#c2904d' }}>{value}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
export default function EmailsClient({
  templates: inicial,
  listasIniciais,
  campanhasIniciais,
}: {
  templates: Template[]
  listasIniciais: Lista[]
  campanhasIniciais: Campanha[]
}) {
  const [aba, setAba] = useState<'templates' | 'listas' | 'campanhas' | 'metricas'>('templates')

  // ── Estado Templates ──────────────────────────────────────────
  const [templates, setTemplates] = useState(inicial)
  const [pilarAtivo, setPilarAtivo] = useState<string>(PILARES[0])
  const [diaAtivo, setDiaAtivo] = useState<number>(0)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [msgTpl, setMsgTpl] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [filtros, setFiltros] = useState({ pilar: '', nivel: '', status: '' })
  const [rascunho, setRascunho] = useState({ assunto: '', corpo_html: '' })

  // ── Estado Listas ─────────────────────────────────────────────
  const [listas, setListas] = useState<Lista[]>(listasIniciais)
  const [showNovaLista, setShowNovaLista] = useState(false)
  const [novaLista, setNovaLista] = useState({ nome: '', descricao: '' })
  const [listaDetalhe, setListaDetalhe] = useState<Lista | null>(null)
  const [contatos, setContatos] = useState<{ id: string; email: string; nome?: string; status: string; criado_em: string }[]>([])
  const [loadingContatos, setLoadingContatos] = useState(false)
  const [novoContato, setNovoContato] = useState({ email: '', nome: '' })
  const [importando, setImportando] = useState(false)
  const [msgLista, setMsgLista] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Estado Campanhas ──────────────────────────────────────────
  const [campanhas, setCampanhas] = useState<Campanha[]>(campanhasIniciais)
  const [showNovaCamp, setShowNovaCamp] = useState(false)
  const [novaCamp, setNovaCamp] = useState({ nome: '', assunto_a: '', assunto_b: '', remetente_nome: 'Maestria Social', remetente_email: '', lista_id: '', html: '', ab_ativo: false })
  const [disparando, setDisparando] = useState<string | null>(null)
  const [campDetalhe, setCampDetalhe] = useState<{ campanha: Campanha; metricas: Record<string, unknown> } | null>(null)
  const [msgCamp, setMsgCamp] = useState<string | null>(null)
  const [previewEmail, setPreviewEmail] = useState('')

  // ── Estado Métricas ───────────────────────────────────────────
  const [metricas, setMetricas] = useState<{ campanhas: Campanha[]; totais: Record<string, number>; taxaAbertura: string; ctr: string } | null>(null)
  const [loadingMetricas, setLoadingMetricas] = useState(false)

  const tpl = templates.find(t => t.pilar === pilarAtivo && t.dia === diaAtivo)

  // ── Funções Templates ─────────────────────────────────────────
  function iniciarEdicao() { if (!tpl) return; setRascunho({ assunto: tpl.assunto, corpo_html: tpl.corpo_html }); setEditando(true); setMsgTpl(null) }
  function cancelarEdicao() { setEditando(false); setMsgTpl(null) }

  async function salvar() {
    if (!tpl) return
    setSalvando(true); setMsgTpl(null)
    try {
      const res = await fetch(`/api/admin/emails/templates/${tpl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rascunho) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, ...rascunho, atualizado_em: data.atualizado_em } : t))
      setEditando(false); setMsgTpl({ tipo: 'ok', texto: 'Template salvo com sucesso.' })
    } catch (e) { setMsgTpl({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' }) }
    finally { setSalvando(false) }
  }

  async function enviarManual() {
    if (!tpl) return
    setEnviando(true); setMsgTpl(null)
    try {
      const payload: Record<string, string> = { template_id: tpl.id }
      if (filtros.pilar) payload.filtro_pilar = filtros.pilar
      if (filtros.nivel) payload.filtro_nivel = filtros.nivel
      if (filtros.status) payload.filtro_status = filtros.status
      const res = await fetch('/api/admin/emails/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsgTpl({ tipo: 'ok', texto: `Enviado: ${data.enviados} ok, ${data.falhas} falhas (total ${data.total}).` })
    } catch (e) { setMsgTpl({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao enviar.' }) }
    finally { setEnviando(false) }
  }

  const filtrosAtivos = [filtros.pilar, filtros.nivel, filtros.status].filter(Boolean).length
  function descricaoFiltros() {
    if (!filtrosAtivos) return 'todos os leads com diagnóstico'
    const p: string[] = []
    if (filtros.pilar) p.push(`pilar: ${filtros.pilar}`)
    if (filtros.nivel) p.push(`nível: ${filtros.nivel}`)
    if (filtros.status) p.push(`status: ${filtros.status}`)
    return p.join(' · ')
  }

  // ── Funções Listas ────────────────────────────────────────────
  async function criarLista() {
    if (!novaLista.nome.trim()) return
    const res = await fetch('/api/admin/emails/listas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaLista) })
    if (res.ok) { const d = await res.json(); setListas(prev => [d.lista, ...prev]); setShowNovaLista(false); setNovaLista({ nome: '', descricao: '' }) }
  }

  async function abrirLista(lista: Lista) {
    setListaDetalhe(lista); setLoadingContatos(true); setMsgLista(null)
    const res = await fetch(`/api/admin/emails/listas/${lista.id}/contatos`)
    if (res.ok) { const d = await res.json(); setContatos(d.contatos || []) }
    setLoadingContatos(false)
  }

  async function adicionarContato() {
    if (!listaDetalhe || !novoContato.email.trim()) return
    const res = await fetch(`/api/admin/emails/listas/${listaDetalhe.id}/contatos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novoContato) })
    if (res.ok) { const d = await res.json(); setContatos(prev => [d.contato, ...prev]); setNovoContato({ email: '', nome: '' }); setListas(prev => prev.map(l => l.id === listaDetalhe.id ? { ...l, total_contatos: l.total_contatos + 1 } : l)) }
  }

  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    if (!listaDetalhe || !e.target.files?.[0]) return
    setImportando(true); setMsgLista(null)
    const text = await e.target.files[0].text()
    const linhas = text.split('\n').filter(l => l.trim())
    const header = linhas[0].toLowerCase().split(/[,;]/).map(h => h.trim().replace(/"/g, ''))
    const emailIdx = header.findIndex(h => h.includes('email') || h.includes('e-mail'))
    const nomeIdx = header.findIndex(h => h.includes('nome') || h.includes('name'))
    if (emailIdx === -1) { setMsgLista('❌ Coluna "email" não encontrada no CSV'); setImportando(false); return }
    const contatosParsed = linhas.slice(1).map(linha => {
      const cols = linha.split(/[,;]/).map(c => c.trim().replace(/"/g, ''))
      return { email: cols[emailIdx] || '', nome: nomeIdx >= 0 ? cols[nomeIdx] : '' }
    }).filter(c => c.email.includes('@'))
    const res = await fetch('/api/admin/emails/listas/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lista_id: listaDetalhe.id, contatos: contatosParsed, origem: 'csv' }) })
    const d = await res.json()
    if (res.ok) { setMsgLista(`✅ ${d.importados} importados, ${d.duplicados} duplicados ignorados`); const r2 = await fetch(`/api/admin/emails/listas/${listaDetalhe.id}/contatos`); if (r2.ok) { const d2 = await r2.json(); setContatos(d2.contatos || []) } }
    else setMsgLista(`❌ ${d.error}`)
    setImportando(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deletarLista(id: string) {
    if (!confirm('Excluir esta lista e todos os seus contatos?')) return
    const res = await fetch(`/api/admin/emails/listas/${id}`, { method: 'DELETE' })
    if (res.ok) { setListas(prev => prev.filter(l => l.id !== id)); if (listaDetalhe?.id === id) setListaDetalhe(null) }
  }

  // ── Funções Campanhas ─────────────────────────────────────────
  async function criarCampanha() {
    if (!novaCamp.nome.trim() || !novaCamp.assunto_a.trim() || !novaCamp.remetente_email.trim()) return
    const res = await fetch('/api/admin/emails/campanhas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaCamp) })
    if (res.ok) { const d = await res.json(); setCampanhas(prev => [d.campanha, ...prev]); setShowNovaCamp(false); setNovaCamp({ nome: '', assunto_a: '', assunto_b: '', remetente_nome: 'Maestria Social', remetente_email: '', lista_id: '', html: '', ab_ativo: false }) }
  }

  async function disparar(campId: string) {
    if (!confirm('Disparar campanha para todos os contatos da lista?')) return
    setDisparando(campId); setMsgCamp(null)
    const res = await fetch(`/api/admin/emails/campanhas/${campId}/disparar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const d = await res.json()
    if (res.ok) { setMsgCamp(`✅ ${d.enviados} enviados, ${d.falhas} falhas`); setCampanhas(prev => prev.map(c => c.id === campId ? { ...c, status: 'enviado', total_enviados: d.enviados } : c)) }
    else setMsgCamp(`❌ ${d.error}`)
    setDisparando(null)
  }

  async function enviarPreview(campId: string) {
    if (!previewEmail.trim()) return
    const res = await fetch(`/api/admin/emails/campanhas/${campId}/disparar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview_email: previewEmail }) })
    if (res.ok) setMsgCamp(`✅ Preview enviado para ${previewEmail}`)
    else { const d = await res.json(); setMsgCamp(`❌ ${d.error}`) }
  }

  async function verMetricasCamp(campId: string) {
    const res = await fetch(`/api/admin/emails/metricas?campanha_id=${campId}`)
    if (res.ok) { const d = await res.json(); setCampDetalhe(d) }
  }

  // ── Funções Métricas ──────────────────────────────────────────
  const carregarMetricas = useCallback(async () => {
    setLoadingMetricas(true)
    const res = await fetch('/api/admin/emails/metricas')
    if (res.ok) setMetricas(await res.json())
    setLoadingMetricas(false)
  }, [])

  // ══════════════════════════════════════════════════════════════
  return (
    <>
      <style>{css}</style>
      <div className='em-wrap'>

        {/* ── TABS ── */}
        <div className='em-tabs'>
          {([['templates','📧 Templates'], ['listas','📋 Listas'], ['campanhas','🚀 Campanhas'], ['metricas','📊 Métricas']] as const).map(([key, label]) => (
            <button key={key} className={`em-tab${aba === key ? ' active' : ''}`}
              onClick={() => { setAba(key); if (key === 'metricas' && !metricas) carregarMetricas() }}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ ABA: TEMPLATES (código original preservado) ══ */}
        {aba === 'templates' && (
          <>
            <div className='em-header'>
              <h1 className='em-title'>Templates do Funil</h1>
              <p className='em-sub'>25 templates segmentados por pilar · edite e envie com filtros</p>
            </div>
            <div className='em-pilares'>
              {PILARES.map(p => (
                <button key={p} className={`em-pilar-btn${pilarAtivo === p ? ' active' : ''}`}
                  onClick={() => { setPilarAtivo(p); setEditando(false); setMsgTpl(null) }}>{p}</button>
              ))}
            </div>
            <div className='em-dias'>
              {DIAS.map(d => (
                <button key={d} className={`em-dia-btn${diaAtivo === d ? ' active' : ''}`}
                  onClick={() => { setDiaAtivo(d); setEditando(false); setMsgTpl(null) }}>{LABEL_DIA[d]}</button>
              ))}
            </div>
            {tpl && (
              <div className='em-card'>
                <div className='em-card-meta'>
                  <span className='em-badge'>{tpl.pilar}</span>
                  <span className='em-badge em-badge-dia'>{LABEL_DIA[tpl.dia]}</span>
                  <span className='em-updated'>Atualizado: {new Date(tpl.atualizado_em).toLocaleString('pt-BR')}</span>
                </div>
                {editando ? (
                  <div className='em-edit-form'>
                    <label className='em-label'>Assunto</label>
                    <input className='em-input' value={rascunho.assunto} onChange={e => setRascunho(r => ({ ...r, assunto: e.target.value }))} />
                    <label className='em-label' style={{ marginTop: 16 }}>Corpo HTML</label>
                    <textarea className='em-textarea' value={rascunho.corpo_html} onChange={e => setRascunho(r => ({ ...r, corpo_html: e.target.value }))} rows={14} />
                    <div className='em-actions'>
                      <button className='em-btn em-btn-primary' onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
                      <button className='em-btn em-btn-ghost' onClick={cancelarEdicao}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className='em-preview'>
                    <div className='em-assunto-label'>Assunto</div>
                    <div className='em-assunto'>{tpl.assunto}</div>
                    <div className='em-assunto-label' style={{ marginTop: 16 }}>Prévia</div>
                    <div className='em-corpo' dangerouslySetInnerHTML={{ __html: tpl.corpo_html }} />
                    <div className='em-filtros-wrap'>
                      <button className='em-filtros-toggle' onClick={() => setMostrarFiltros(v => !v)}>
                        <span>⚙ Filtros de envio</span>
                        {filtrosAtivos > 0 && <span className='em-filtro-count'>{filtrosAtivos} ativo{filtrosAtivos > 1 ? 's' : ''}</span>}
                        <span className='em-filtros-chevron'>{mostrarFiltros ? '▲' : '▼'}</span>
                      </button>
                      {mostrarFiltros && (
                        <div className='em-filtros-box'>
                          <div className='em-filtros-row'>
                            <div className='em-filtro-field'>
                              <label className='em-label'>Pilar fraco</label>
                              <select className='em-select' value={filtros.pilar} onChange={e => setFiltros(f => ({ ...f, pilar: e.target.value }))}>
                                <option value=''>Todos</option>{PILARES.map(p => <option key={p}>{p}</option>)}
                              </select>
                            </div>
                            <div className='em-filtro-field'>
                              <label className='em-label'>Nível QS</label>
                              <select className='em-select' value={filtros.nivel} onChange={e => setFiltros(f => ({ ...f, nivel: e.target.value }))}>
                                <option value=''>Todos</option>{NIVEIS.map(n => <option key={n}>{n}</option>)}
                              </select>
                            </div>
                            <div className='em-filtro-field'>
                              <label className='em-label'>Status lead</label>
                              <select className='em-select' value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
                                <option value=''>Todos</option>{STATUS_LEAD.map(s => <option key={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className='em-actions'>
                      <button className='em-btn em-btn-primary' onClick={iniciarEdicao}>✎ Editar</button>
                      <button className='em-btn em-btn-send' onClick={enviarManual} disabled={enviando}>
                        {enviando ? 'Enviando...' : `↗ Enviar para ${descricaoFiltros()}`}
                      </button>
                    </div>
                  </div>
                )}
                {msgTpl && <div className={`em-msg ${msgTpl.tipo}`}>{msgTpl.texto}</div>}
              </div>
            )}
          </>
        )}

        {/* ══ ABA: LISTAS ══ */}
        {aba === 'listas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ color: '#fff9e6', fontSize: 22, fontWeight: 800, margin: 0 }}>Listas de E-mails</h2>
                <p style={{ color: '#4a3e30', fontSize: 13, margin: '4px 0 0' }}>Importe contatos, segmente e organize suas listas</p>
              </div>
              <button className='em-btn em-btn-primary' onClick={() => setShowNovaLista(true)}>+ Nova Lista</button>
            </div>

            {showNovaLista && (
              <div className='em-card' style={{ marginBottom: 20 }}>
                <label className='em-label'>Nome da lista *</label>
                <input className='em-input' value={novaLista.nome} onChange={e => setNovaLista(n => ({ ...n, nome: e.target.value }))} placeholder='Ex: Leads Quiz Abril' style={{ marginBottom: 12 }} />
                <label className='em-label'>Descrição</label>
                <input className='em-input' value={novaLista.descricao} onChange={e => setNovaLista(n => ({ ...n, descricao: e.target.value }))} placeholder='Opcional...' style={{ marginBottom: 16 }} />
                <div className='em-actions'>
                  <button className='em-btn em-btn-primary' onClick={criarLista}>Criar Lista</button>
                  <button className='em-btn em-btn-ghost' onClick={() => setShowNovaLista(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {listaDetalhe ? (
              <div>
                <button className='em-btn em-btn-ghost' style={{ marginBottom: 16 }} onClick={() => setListaDetalhe(null)}>← Voltar</button>
                <div className='em-card'>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                      <h3 style={{ color: '#fff9e6', fontSize: 18, fontWeight: 700, margin: 0 }}>{listaDetalhe.nome}</h3>
                      <p style={{ color: '#4a3e30', fontSize: 13, margin: '4px 0 0' }}>{listaDetalhe.total_contatos} contatos ativos</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input ref={fileRef} type='file' accept='.csv,.txt' style={{ display: 'none' }} onChange={importarCSV} />
                      <button className='em-btn em-btn-primary' onClick={() => fileRef.current?.click()} disabled={importando}>
                        {importando ? '⏳ Importando...' : '📤 Importar CSV'}
                      </button>
                    </div>
                  </div>
                  {msgLista && <div className='em-msg' style={{ marginBottom: 16, background: msgLista.startsWith('✅') ? 'rgba(100,180,100,.08)' : 'rgba(224,112,112,.08)', border: `1px solid ${msgLista.startsWith('✅') ? 'rgba(100,180,100,.2)' : 'rgba(224,112,112,.2)'}`, color: msgLista.startsWith('✅') ? '#7ab87a' : '#e07070' }}>{msgLista}</div>}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <input className='em-input' value={novoContato.email} onChange={e => setNovoContato(c => ({ ...c, email: e.target.value }))} placeholder='email@exemplo.com' style={{ flex: 2 }} />
                    <input className='em-input' value={novoContato.nome} onChange={e => setNovoContato(c => ({ ...c, nome: e.target.value }))} placeholder='Nome (opcional)' style={{ flex: 2 }} />
                    <button className='em-btn em-btn-primary' onClick={adicionarContato} style={{ flexShrink: 0 }}>+ Adicionar</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                    {loadingContatos ? <p style={{ color: '#4a3e30', textAlign: 'center', padding: 24 }}>Carregando...</p>
                      : contatos.length === 0 ? <p style={{ color: '#4a3e30', textAlign: 'center', padding: 24 }}>Nenhum contato ainda</p>
                      : contatos.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(255,255,255,.02)', borderRadius: 8, border: '1px solid #2a1f18' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ color: '#c8b99a', fontSize: 13 }}>{c.email}</span>
                            {c.nome && <span style={{ color: '#4a3e30', fontSize: 12, marginLeft: 8 }}>{c.nome}</span>}
                          </div>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: c.status === 'ativo' ? 'rgba(100,180,100,.1)' : 'rgba(224,112,112,.1)', color: c.status === 'ativo' ? '#7ab87a' : '#e07070' }}>{c.status}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
                {listas.length === 0 ? <p style={{ color: '#4a3e30', gridColumn: '1/-1' }}>Nenhuma lista criada ainda.</p>
                  : listas.map(l => (
                    <div key={l.id} className='em-card' style={{ cursor: 'pointer' }} onClick={() => abrirLista(l)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ color: '#fff9e6', fontSize: 16, fontWeight: 700, margin: 0 }}>{l.nome}</h3>
                        <button onClick={e => { e.stopPropagation(); deletarLista(l.id) }} style={{ background: 'none', border: 'none', color: '#4a3e30', cursor: 'pointer', fontSize: 14 }}>🗑</button>
                      </div>
                      {l.descricao && <p style={{ color: '#4a3e30', fontSize: 12, margin: '6px 0 0' }}>{l.descricao}</p>}
                      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#c2904d' }}>{l.total_contatos}</div>
                        <div style={{ fontSize: 12, color: '#4a3e30', alignSelf: 'flex-end', marginBottom: 3 }}>contatos ativos</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#2a1f18', marginTop: 8 }}>Criada: {new Date(l.criado_em).toLocaleDateString('pt-BR')}</div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* ══ ABA: CAMPANHAS ══ */}
        {aba === 'campanhas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ color: '#fff9e6', fontSize: 22, fontWeight: 800, margin: 0 }}>Campanhas</h2>
                <p style={{ color: '#4a3e30', fontSize: 13, margin: '4px 0 0' }}>Dispare e-mails para listas completas com rastreamento</p>
              </div>
              <button className='em-btn em-btn-primary' onClick={() => setShowNovaCamp(true)}>+ Nova Campanha</button>
            </div>

            {msgCamp && <div className='em-msg' style={{ marginBottom: 16, background: msgCamp.startsWith('✅') ? 'rgba(100,180,100,.08)' : 'rgba(224,112,112,.08)', border: `1px solid ${msgCamp.startsWith('✅') ? 'rgba(100,180,100,.2)' : 'rgba(224,112,112,.2)'}`, color: msgCamp.startsWith('✅') ? '#7ab87a' : '#e07070' }}>{msgCamp}</div>}

            {showNovaCamp && (
              <div className='em-card' style={{ marginBottom: 24 }}>
                <h3 style={{ color: '#fff9e6', fontWeight: 700, margin: '0 0 20px' }}>Nova Campanha</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div><label className='em-label'>Nome interno *</label><input className='em-input' value={novaCamp.nome} onChange={e => setNovaCamp(c => ({ ...c, nome: e.target.value }))} placeholder='Ex: Black Friday 2026' /></div>
                  <div><label className='em-label'>Lista de destino</label>
                    <select className='em-select' style={{ width: '100%' }} value={novaCamp.lista_id} onChange={e => setNovaCamp(c => ({ ...c, lista_id: e.target.value }))}>
                      <option value=''>Selecionar lista...</option>{listas.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.total_contatos} contatos)</option>)}
                    </select>
                  </div>
                  <div><label className='em-label'>Assunto A *</label><input className='em-input' value={novaCamp.assunto_a} onChange={e => setNovaCamp(c => ({ ...c, assunto_a: e.target.value }))} placeholder='Assunto do e-mail' /></div>
                  <div><label className='em-label'>Assunto B (A/B test)</label><input className='em-input' value={novaCamp.assunto_b} onChange={e => setNovaCamp(c => ({ ...c, assunto_b: e.target.value }))} placeholder='Variante B do assunto' /></div>
                  <div><label className='em-label'>Nome remetente</label><input className='em-input' value={novaCamp.remetente_nome} onChange={e => setNovaCamp(c => ({ ...c, remetente_nome: e.target.value }))} /></div>
                  <div><label className='em-label'>E-mail remetente *</label><input className='em-input' value={novaCamp.remetente_email} onChange={e => setNovaCamp(c => ({ ...c, remetente_email: e.target.value }))} placeholder='suporte@seudominio.com' /></div>
                </div>
                <label className='em-label'>Conteúdo HTML</label>
                <textarea className='em-textarea' value={novaCamp.html} onChange={e => setNovaCamp(c => ({ ...c, html: e.target.value }))} rows={8} placeholder='Cole o HTML do e-mail aqui. Use {nome} para personalizar.' style={{ marginBottom: 16 }} />
                <div className='em-actions'>
                  <button className='em-btn em-btn-primary' onClick={criarCampanha}>Salvar Campanha</button>
                  <button className='em-btn em-btn-ghost' onClick={() => setShowNovaCamp(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {campDetalhe && (
              <div className='em-card' style={{ marginBottom: 24, border: '1px solid rgba(194,144,77,.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ color: '#fff9e6', fontWeight: 700, margin: 0 }}>📊 {campDetalhe.campanha.nome}</h3>
                  <button onClick={() => setCampDetalhe(null)} style={{ background: 'none', border: 'none', color: '#4a3e30', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {[
                    ['Enviados', campDetalhe.metricas.total as number, '#c2904d'],
                    ['Abertos', campDetalhe.metricas.abertos as number, '#10b981'],
                    ['Cliques', campDetalhe.metricas.clicados as number, '#6366f1'],
                    ['Bounce', campDetalhe.metricas.bounced as number, '#ef4444'],
                    ['Taxa abertura', `${campDetalhe.metricas.taxaAbertura}%`, '#f59e0b'],
                    ['CTR', `${campDetalhe.metricas.ctr}%`, '#8b5cf6'],
                    ['CTOR', `${campDetalhe.metricas.ctor}%`, '#06b6d4'],
                  ].map(([label, value, cor]) => <Stat key={label as string} label={label as string} value={value as string} cor={cor as string} />)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {campanhas.length === 0 ? <p style={{ color: '#4a3e30' }}>Nenhuma campanha criada.</p>
                : campanhas.map(c => (
                  <div key={c.id} className='em-card' style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ color: '#fff9e6', fontWeight: 700, fontSize: 15 }}>{c.nome}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${STATUS_COR[c.status]}22`, color: STATUS_COR[c.status], fontWeight: 700, border: `1px solid ${STATUS_COR[c.status]}44` }}>{c.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#4a3e30' }}>
                        {c.email_listas?.nome && <span>📋 {c.email_listas.nome} · </span>}
                        <span>Assunto: {c.assunto_a}</span>
                      </div>
                      {c.status === 'enviado' && (
                        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                          {[['✉', c.total_enviados, 'enviados'], ['👁', c.total_abertos, 'abertos'], ['🖱', c.total_cliques, 'cliques']].map(([icon, val, lbl]) => (
                            <span key={lbl as string} style={{ fontSize: 12, color: '#7a6e5e' }}>{icon} {val} {lbl}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexDirection: 'column', alignItems: 'flex-end' }}>
                      {c.status === 'rascunho' && (
                        <>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input value={previewEmail} onChange={e => setPreviewEmail(e.target.value)} placeholder='Preview para...' className='em-input' style={{ width: 180, fontSize: 12, padding: '6px 10px' }} />
                            <button className='em-btn em-btn-ghost' style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => enviarPreview(c.id)}>Testar</button>
                          </div>
                          <button className='em-btn em-btn-send' style={{ fontSize: 13, padding: '8px 16px' }} onClick={() => disparar(c.id)} disabled={disparando === c.id}>
                            {disparando === c.id ? '⏳ Disparando...' : '🚀 Disparar'}
                          </button>
                        </>
                      )}
                      {c.status === 'enviado' && (
                        <button className='em-btn em-btn-ghost' style={{ fontSize: 12 }} onClick={() => verMetricasCamp(c.id)}>📊 Ver métricas</button>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ══ ABA: MÉTRICAS ══ */}
        {aba === 'metricas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ color: '#fff9e6', fontSize: 22, fontWeight: 800, margin: 0 }}>Métricas Gerais</h2>
                <p style={{ color: '#4a3e30', fontSize: 13, margin: '4px 0 0' }}>Últimos 30 dias</p>
              </div>
              <button className='em-btn em-btn-ghost' onClick={carregarMetricas} disabled={loadingMetricas}>{loadingMetricas ? '⏳' : '↺ Atualizar'}</button>
            </div>

            {!metricas ? (
              <p style={{ color: '#4a3e30' }}>Carregando...</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
                  <Stat label='Total enviados' value={metricas.totais.enviados || 0} />
                  <Stat label='Abertos' value={metricas.totais.abertos || 0} cor='#10b981' />
                  <Stat label='Cliques' value={metricas.totais.cliques || 0} cor='#6366f1' />
                  <Stat label='Bounced' value={metricas.totais.bounced || 0} cor='#ef4444' />
                  <Stat label='Taxa abertura' value={`${metricas.taxaAbertura}%`} cor='#f59e0b' />
                  <Stat label='CTR' value={`${metricas.ctr}%`} cor='#8b5cf6' />
                </div>

                <h3 style={{ color: '#c8b99a', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Campanhas recentes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {metricas.campanhas.map((c: Campanha) => {
                    const taxa = c.total_enviados > 0 ? ((c.total_abertos / c.total_enviados) * 100).toFixed(1) : '0'
                    const ctr = c.total_enviados > 0 ? ((c.total_cliques / c.total_enviados) * 100).toFixed(1) : '0'
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: '#1a1410', border: '1px solid #2a1f18', borderRadius: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#c8b99a', fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                          <div style={{ color: '#4a3e30', fontSize: 12, marginTop: 2 }}>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</div>
                        </div>
                        {[
                          [c.total_enviados, 'enviados', '#7a6e5e'],
                          [c.total_abertos, 'abertos', '#10b981'],
                          [c.total_cliques, 'cliques', '#6366f1'],
                          [`${taxa}%`, 'abertura', '#f59e0b'],
                          [`${ctr}%`, 'CTR', '#8b5cf6'],
                        ].map(([val, lbl, cor]) => (
                          <div key={lbl as string} style={{ textAlign: 'center', minWidth: 64 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: cor as string }}>{val}</div>
                            <div style={{ fontSize: 10, color: '#4a3e30', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lbl}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {metricas.campanhas.length === 0 && <p style={{ color: '#4a3e30' }}>Nenhuma campanha nos últimos 30 dias.</p>}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── CSS ─────────────────────────────────────────────────────────
const css = `
  .em-wrap{padding:40px;max-width:1100px;}
  .em-tabs{display:flex;gap:4px;margin-bottom:32px;background:#111009;border:1px solid #2a1f18;border-radius:12px;padding:4px;}
  .em-tab{flex:1;padding:10px 16px;border:none;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;background:transparent;color:#4a3e30;transition:all .15s;}
  .em-tab:hover{color:#c8b99a;background:rgba(255,255,255,.03);}
  .em-tab.active{background:rgba(194,144,77,.12);color:#c2904d;border:1px solid rgba(194,144,77,.25);}
  .em-header{margin-bottom:28px;}
  .em-title{font-size:28px;color:#fff9e6;margin-bottom:6px;font-weight:800;}
  .em-sub{font-size:13px;color:#7a6e5e;margin:0;}
  .em-pilares{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
  .em-pilar-btn{background:rgba(255,255,255,.03);border:1px solid #2a1f18;color:#7a6e5e;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;}
  .em-pilar-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .em-pilar-btn.active{background:rgba(194,144,77,.1);border-color:rgba(194,144,77,.3);color:#c2904d;}
  .em-dias{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px;}
  .em-dia-btn{background:rgba(255,255,255,.02);border:1px solid #2a1f18;color:#7a6e5e;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit;transition:all .15s;}
  .em-dia-btn:hover{border-color:rgba(194,144,77,.2);color:#c2904d;}
  .em-dia-btn.active{background:rgba(194,144,77,.08);border-color:rgba(194,144,77,.25);color:#c2904d;}
  .em-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px;}
  .em-card-meta{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap;}
  .em-badge{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2904d;background:rgba(194,144,77,.08);border:1px solid rgba(194,144,77,.2);padding:4px 10px;border-radius:6px;}
  .em-badge-dia{color:#7a9ec0;background:rgba(122,158,192,.08);border-color:rgba(122,158,192,.2);}
  .em-updated{font-size:11px;color:#4a3e30;margin-left:auto;}
  .em-assunto-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;margin-bottom:6px;}
  .em-assunto{font-size:16px;font-weight:600;color:#fff9e6;}
  .em-corpo{font-size:14px;line-height:1.7;color:#cdbfa8;padding:16px;background:rgba(0,0,0,.2);border-radius:10px;border:1px solid #2a1f18;}
  .em-corpo p{margin:0 0 10px;}.em-corpo a{color:#c2904d;}
  .em-filtros-wrap{margin-top:20px;border:1px solid #2a1f18;border-radius:10px;overflow:hidden;}
  .em-filtros-toggle{width:100%;display:flex;align-items:center;gap:8px;padding:12px 16px;background:rgba(255,255,255,.02);border:none;color:#7a6e5e;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;}
  .em-filtro-count{background:rgba(194,144,77,.15);color:#c2904d;border:1px solid rgba(194,144,77,.25);font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;}
  .em-filtros-chevron{margin-left:auto;font-size:10px;color:#4a3e30;}
  .em-filtros-box{padding:16px;border-top:1px solid #2a1f18;background:#13100c;}
  .em-filtros-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;}
  .em-filtro-field{display:flex;flex-direction:column;gap:6px;}
  .em-select{background:#1a1410;border:1px solid #2a1f18;border-radius:8px;padding:9px 12px;color:#fff9e6;font-size:13px;font-family:inherit;outline:none;cursor:pointer;}
  .em-select option{background:#1a1410;}
  .em-actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;}
  .em-btn{padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;border:none;transition:filter .15s,opacity .15s;}
  .em-btn:disabled{opacity:.4;cursor:default;}
  .em-btn-primary{background:rgba(194,144,77,.12);border:1px solid rgba(194,144,77,.3);color:#c2904d;}
  .em-btn-primary:hover:not(:disabled){filter:brightness(1.1);}
  .em-btn-ghost{background:transparent;border:1px solid #2a1f18;color:#7a6e5e;}
  .em-btn-ghost:hover{color:#fff9e6;border-color:#4a3e30;}
  .em-btn-send{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;}
  .em-btn-send:hover:not(:disabled){filter:brightness(1.08);}
  .em-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;display:block;margin-bottom:6px;}
  .em-input{width:100%;background:#13100c;border:1px solid #2a1f18;border-radius:8px;padding:10px 12px;color:#fff9e6;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .15s;}
  .em-input:focus{border-color:rgba(194,144,77,.35);}
  .em-textarea{width:100%;background:#13100c;border:1px solid #2a1f18;border-radius:8px;padding:12px;color:#cdbfa8;font-size:13px;font-family:monospace;outline:none;resize:vertical;line-height:1.6;box-sizing:border-box;}
  .em-textarea:focus{border-color:rgba(194,144,77,.35);}
  .em-edit-form{display:flex;flex-direction:column;}
  .em-msg{margin-top:16px;padding:10px 14px;border-radius:8px;font-size:13px;}
  .em-preview{display:flex;flex-direction:column;gap:4px;}
  @media(max-width:768px){.em-wrap{padding:16px;}.em-tabs{flex-direction:column;}.em-tab{text-align:center;}}
`

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Pagina {
  id: string; nome: string; slug: string; descricao?: string
  publicada: boolean; criado_em: string; atualizado_em: string
}

export default function PaginasList({ paginasIniciais }: { paginasIniciais: Pagina[] }) {
  const [paginas, setPaginas] = useState(paginasIniciais)
  const [showNova, setShowNova] = useState(false)
  const [nomaNovo, setNomeNovo] = useState('')
  const [slugNovo, setSlugNovo] = useState('')
  const [descNovo, setDescNovo] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const router = useRouter()

  const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

  const handleNomeChange = (v: string) => {
    setNomeNovo(v)
    setSlugNovo(slugify(v))
  }

  const createPagina = async (conteudo: unknown[] = [], configuracoes: Record<string, unknown> = {}, nomeOverride?: string) => {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/paginas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeOverride || nomaNovo, slug: slugNovo || slugify(nomeOverride || nomaNovo), descricao: descNovo || null, conteudo, configuracoes }),
      })
      if (res.ok) {
        const data = await res.json()
        setShowNova(false)
        setShowAI(false)
        setNomeNovo(''); setSlugNovo(''); setDescNovo(''); setAiPrompt('')
        router.push(`/dashboard/paginas/${data.pagina.id}/editor`)
      } else {
        const err = await res.json()
        alert(err.error || 'Erro ao criar página')
      }
    } finally { setCreating(false) }
  }

  const generateAndCreate = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/admin/paginas/gerar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error || `Erro ${res.status}`)
        return
      }
      const nome = data.nome || 'Nova Página'
      setNomeNovo(nome)
      setSlugNovo(slugify(nome))
      await createPagina(data.conteudo || [], data.configuracoes || {}, nome)
    } catch (err) {
      setAiError(`Falha de rede: ${String(err)}`)
    } finally { setAiLoading(false) }
  }

  const togglePublish = async (id: string, publicada: boolean) => {
    const res = await fetch(`/api/admin/paginas/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicada: !publicada }),
    })
    if (res.ok) {
      setPaginas(prev => prev.map(p => p.id === id ? { ...p, publicada: !publicada } : p))
    }
  }

  const deletePagina = async (id: string) => {
    if (!confirm('Excluir esta página permanentemente?')) return
    setDeletingId(id)
    const res = await fetch(`/api/admin/paginas/${id}`, { method: 'DELETE' })
    if (res.ok) setPaginas(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  return (
    <>
      <style>{css}</style>
      <div className="pag-container">

        {/* Header */}
        <div className="pag-header">
          <div>
            <h1 className="pag-title">🎨 Páginas</h1>
            <p className="pag-subtitle">Crie e edite páginas públicas com o editor visual</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pag-btn-ai" onClick={() => setShowAI(true)}>✨ Gerar com IA</button>
            <button className="pag-btn-primary" onClick={() => setShowNova(true)}>+ Nova Página</button>
          </div>
        </div>

        {/* List */}
        {paginas.length === 0 ? (
          <div className="pag-empty">
            <div className="pag-empty-icon">🎨</div>
            <p className="pag-empty-title">Nenhuma página criada ainda</p>
            <p className="pag-empty-sub">Crie sua primeira página ou deixe a IA criar para você</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
              <button className="pag-btn-ai" onClick={() => setShowAI(true)}>✨ Gerar com IA</button>
              <button className="pag-btn-primary" onClick={() => setShowNova(true)}>+ Criar Página</button>
            </div>
          </div>
        ) : (
          <div className="pag-grid">
            {paginas.map(p => (
              <div key={p.id} className="pag-card">
                <div className="pag-card-top">
                  <div className="pag-card-status">
                    <span className={`pag-badge ${p.publicada ? 'pag-badge-green' : 'pag-badge-gray'}`}>
                      {p.publicada ? '● Publicada' : '○ Rascunho'}
                    </span>
                  </div>
                  <h3 className="pag-card-nome">{p.nome}</h3>
                  {p.descricao && <p className="pag-card-desc">{p.descricao}</p>}
                  <a href={`/p/${p.slug}`} target="_blank" rel="noopener noreferrer" className="pag-card-slug">
                    /p/{p.slug} ↗
                  </a>
                </div>
                <div className="pag-card-meta">
                  Atualizado: {new Date(p.atualizado_em).toLocaleDateString('pt-BR')}
                </div>
                <div className="pag-card-actions">
                  <button className="pag-btn-edit" onClick={() => router.push(`/dashboard/paginas/${p.id}/editor`)}>
                    ✏️ Editar
                  </button>
                  <button className="pag-btn-toggle" onClick={() => togglePublish(p.id, p.publicada)}>
                    {p.publicada ? '🚫 Despublicar' : '✅ Publicar'}
                  </button>
                  <button className="pag-btn-delete" onClick={() => deletePagina(p.id)} disabled={deletingId === p.id}>
                    {deletingId === p.id ? '...' : '🗑'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal nova página */}
        {showNova && (
          <div className="pag-overlay" onClick={() => !creating && setShowNova(false)}>
            <div className="pag-modal" onClick={e => e.stopPropagation()}>
              <div className="pag-modal-header">
                <h2>Nova Página</h2>
                <button onClick={() => setShowNova(false)} className="pag-modal-close">✕</button>
              </div>
              <div className="pag-field">
                <label>Nome da página *</label>
                <input value={nomaNovo} onChange={e => handleNomeChange(e.target.value)} placeholder="Ex: Landing Page Principal" className="pag-input" />
              </div>
              <div className="pag-field">
                <label>Slug (URL)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#888', fontSize: 13 }}>/p/</span>
                  <input value={slugNovo} onChange={e => setSlugNovo(e.target.value)} placeholder="landing-page" className="pag-input" style={{ flex: 1 }} />
                </div>
              </div>
              <div className="pag-field">
                <label>Descrição (opcional)</label>
                <input value={descNovo} onChange={e => setDescNovo(e.target.value)} placeholder="Uma breve descrição..." className="pag-input" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="pag-btn-primary" style={{ flex: 1 }} onClick={() => createPagina()} disabled={creating || !nomaNovo.trim()}>
                  {creating ? 'Criando...' : 'Criar Página Vazia'}
                </button>
                <button className="pag-btn-cancel" onClick={() => setShowNova(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal AI */}
        {showAI && (
          <div className="pag-overlay" onClick={() => !aiLoading && setShowAI(false)}>
            <div className="pag-modal" onClick={e => e.stopPropagation()}>
              <div className="pag-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>✨</span>
                  <div>
                    <h2 style={{ margin: 0 }}>Criar com IA</h2>
                    <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Descreva e a IA cria a página completa</p>
                  </div>
                </div>
                <button onClick={() => setShowAI(false)} className="pag-modal-close">✕</button>
              </div>
              {[
                'Landing page de curso de fotografia com preços e depoimentos',
                'Página de captura para lista VIP com oferta irresistível',
                'Página de vendas para produto digital com urgência e garantia',
              ].map(s => (
                <button key={s} onClick={() => setAiPrompt(s)} className="pag-ai-suggestion">💡 {s}</button>
              ))}
              <div className="pag-field" style={{ marginTop: 12 }}>
                <label>Descreva sua página</label>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={4} placeholder="Ex: Crie uma landing page premium para consultório de psicologia..." className="pag-input" style={{ resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="pag-btn-ai" style={{ flex: 1 }} onClick={generateAndCreate} disabled={aiLoading || !aiPrompt.trim()}>
                  {aiLoading ? '⏳ Gerando...' : '🚀 Gerar e Abrir no Editor'}
                </button>
                <button className="pag-btn-cancel" onClick={() => setShowAI(false)}>Cancelar</button>
              </div>
              {aiLoading && <p style={{ textAlign: 'center', color: '#888', fontSize: 12, marginTop: 12 }}>⏳ Gerando com IA... pode levar até 30s</p>}
              {aiError && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8 }}><p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>❌ {aiError}</p></div>}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const css = `
.pag-container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
.pag-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
.pag-title { font-size: clamp(22px,3vw,32px); font-weight: 800; margin: 0 0 4px; }
.pag-subtitle { color: #888; font-size: 14px; margin: 0; }
.pag-btn-primary { padding: 10px 20px; background: #6366f1; color: #fff; border: none; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 14px; font-family: inherit; }
.pag-btn-ai { padding: 10px 20px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; border: none; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 14px; font-family: inherit; }
.pag-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(300px,1fr)); gap: 20px; }
.pag-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 12px; transition: box-shadow .2s; }
.pag-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.08); }
.pag-card-top { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.pag-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-block; }
.pag-badge-green { background: #d1fae5; color: #065f46; }
.pag-badge-gray { background: #f3f4f6; color: #6b7280; }
.pag-card-nome { font-size: 18px; font-weight: 700; margin: 0; }
.pag-card-desc { font-size: 13px; color: #888; margin: 0; }
.pag-card-slug { font-size: 12px; color: #6366f1; text-decoration: none; font-family: monospace; }
.pag-card-meta { font-size: 11px; color: #bbb; }
.pag-card-actions { display: flex; gap: 8px; }
.pag-btn-edit { flex: 1; padding: 8px; background: #f0f0ff; color: #6366f1; border: 1px solid #c7d2fe; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; }
.pag-btn-toggle { flex: 1; padding: 8px; background: #f9fafb; color: #555; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: inherit; }
.pag-btn-delete { padding: 8px 12px; background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 8px; cursor: pointer; font-size: 13px; font-family: inherit; }
.pag-empty { text-align: center; padding: 80px 24px; color: #aaa; }
.pag-empty-icon { font-size: 64px; margin-bottom: 16px; }
.pag-empty-title { font-size: 20px; font-weight: 700; color: #555; margin: 0 0 8px; }
.pag-empty-sub { font-size: 14px; margin: 0; }
.pag-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.pag-modal { background: #fff; border-radius: 20px; padding: 28px; width: 100%; max-width: 520px; box-shadow: 0 24px 80px rgba(0,0,0,.2); }
.pag-modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.pag-modal-header h2 { font-size: 20px; font-weight: 800; margin: 0; }
.pag-modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #aaa; padding: 0; line-height: 1; }
.pag-field { margin-bottom: 16px; }
.pag-field label { display: block; font-size: 12px; font-weight: 600; color: #777; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .5px; }
.pag-input { width: 100%; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; outline: none; font-family: inherit; box-sizing: border-box; color: #111; background: #fff; }
.pag-input:focus { border-color: #6366f1; }
.pag-btn-cancel { padding: 10px 16px; background: #f3f4f6; color: #555; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; font-family: inherit; }
.pag-ai-suggestion { width: 100%; padding: 9px 12px; background: #f8f9ff; border: 1px solid #e0e4ff; border-radius: 8px; color: #555; font-size: 12px; cursor: pointer; text-align: left; margin-bottom: 6px; font-family: inherit; }
.pag-ai-suggestion:hover { background: #eef0ff; }
`

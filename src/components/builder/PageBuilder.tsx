'use client'

import { useState, useCallback, useRef, useEffect, memo } from 'react'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Block, BlockType, BlockMeta, BLOCK_META, BLOCK_CATEGORIES, PageConfig, createBlock, nanoid } from '@/lib/builder/blocks'
import { BlockRenderer } from './BlockRenderer'
import dynamic from 'next/dynamic'

// Lazy load heavy panels
const PropertiesPanel = dynamic(() => import('./PropertiesPanel'), { ssr: false })

const MAX_HISTORY = 50

interface PageBuilderProps {
  paginaId: string
  nomeInicial: string
  slugInicial: string
  blocos: Block[]
  config: PageConfig
}

// ── History hook ──────────────────────────────────────────────────
function useHistory(initial: Block[]) {
  const stack = useRef<Block[][]>([initial])
  const idx = useRef(0)
  const [, forceUpdate] = useState(0)

  const push = useCallback((blocks: Block[]) => {
    stack.current = stack.current.slice(0, idx.current + 1)
    stack.current.push(JSON.parse(JSON.stringify(blocks)))
    if (stack.current.length > MAX_HISTORY) stack.current.shift()
    idx.current = stack.current.length - 1
    forceUpdate(n => n + 1)
  }, [])

  const undo = useCallback((): Block[] | null => {
    if (idx.current <= 0) return null
    idx.current--
    forceUpdate(n => n + 1)
    return JSON.parse(JSON.stringify(stack.current[idx.current]))
  }, [])

  const redo = useCallback((): Block[] | null => {
    if (idx.current >= stack.current.length - 1) return null
    idx.current++
    forceUpdate(n => n + 1)
    return JSON.parse(JSON.stringify(stack.current[idx.current]))
  }, [])

  return { push, undo, redo, canUndo: idx.current > 0, canRedo: idx.current < stack.current.length - 1 }
}

export default function PageBuilder({ paginaId, nomeInicial, slugInicial, blocos, config }: PageBuilderProps) {
  const [blocks, setBlocks] = useState<Block[]>(blocos)
  const [selected, setSelected] = useState<string | null>(null)
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [nome, setNome] = useState(nomeInicial)
  const [pageConfig, setPageConfig] = useState<PageConfig>(config)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [showAI, setShowAI] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [versoes, setVersoes] = useState<Array<{ id: string; nome: string; criado_em: string }>>([])
  const [showColorPanel, setShowColorPanel] = useState(false)
  const [draggedType, setDraggedType] = useState<BlockType | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const history = useHistory(blocos)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const selectedBlock = blocks.find(b => b.id === selected) ?? null

  // ── Save (manual only) ─────────────────────────────────────────
  const saveToServer = useCallback(async (b: Block[], n: string, cfg: PageConfig) => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/admin/paginas/${paginaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: n, conteudo: b, configuracoes: cfg }),
      })
      if (res.ok) setSaveStatus('saved')
      else setSaveStatus('unsaved')
    } catch { setSaveStatus('unsaved') }
  }, [paginaId])

  // ── Save version (manual) ──────────────────────────────────────
  const saveVersion = useCallback(async () => {
    const ts = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    await saveToServer(blocks, nome, pageConfig)
    await fetch(`/api/admin/paginas/${paginaId}/versoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: `${nome} — ${ts}`, conteudo: blocks, configuracoes: pageConfig }),
    })
    loadVersions()
  }, [blocks, nome, pageConfig, paginaId, saveToServer])

  const loadVersions = useCallback(async () => {
    const res = await fetch(`/api/admin/paginas/${paginaId}/versoes`)
    if (res.ok) { const d = await res.json(); setVersoes(d.versoes || []) }
  }, [paginaId])

  const restoreVersion = useCallback(async (versaoId: string) => {
    const res = await fetch(`/api/admin/paginas/${paginaId}/versoes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versao_id: versaoId }),
    })
    if (res.ok) {
      const d = await res.json()
      const newBlocks = d.pagina?.conteudo || []
      setBlocks(newBlocks)
      history.push(newBlocks)
      if (d.pagina?.configuracoes) setPageConfig(d.pagina.configuracoes)
      setShowVersions(false)
    }
  }, [paginaId, history])

  // ── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const prev = history.undo()
        if (prev) { setBlocks(prev); setSelected(null) }
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        const next = history.redo()
        if (next) { setBlocks(next); setSelected(null) }
      }
      if (mod && e.key === 's') {
        e.preventDefault()
        saveVersion()
      }
      if (e.key === 'Escape') setSelected(null)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !(e.target as HTMLElement).matches('input,textarea')) {
        deleteBlock(selected)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, history])

  // ── Block operations ───────────────────────────────────────────
  const setBlocksAndHistory = useCallback((updater: (prev: Block[]) => Block[]) => {
    setBlocks(prev => {
      const next = updater(prev)
      history.push(next)
      setSaveStatus('unsaved')
      return next
    })
  }, [history])

  const addBlock = useCallback((type: BlockType, insertAt?: number) => {
    const block = createBlock(type)
    setBlocksAndHistory(prev => {
      const next = [...prev]
      next.splice(insertAt ?? next.length, 0, block)
      return next
    })
    setSelected(block.id)
  }, [setBlocksAndHistory])

  const deleteBlock = useCallback((id: string) => {
    setBlocksAndHistory(prev => prev.filter(b => b.id !== id))
    setSelected(null)
  }, [setBlocksAndHistory])

  const duplicateBlock = useCallback((id: string) => {
    setBlocksAndHistory(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx === -1) return prev
      const clone = { ...prev[idx], id: nanoid(), props: { ...prev[idx].props } }
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next
    })
  }, [setBlocksAndHistory])

  const moveBlock = useCallback((id: string, dir: 'up' | 'down') => {
    setBlocksAndHistory(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx === -1) return prev
      const next = [...prev]
      if (dir === 'up' && idx > 0) [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      else if (dir === 'down' && idx < next.length - 1) [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [setBlocksAndHistory])

  const updateBlockProps = useCallback((id: string, props: Partial<Record<string, unknown>>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, props: { ...b.props, ...props } } : b))
    setSaveStatus('unsaved')
  }, [])

  // ── Nome/Config change ─────────────────────────────────────────
  const handleNomeChange = (n: string) => {
    setNome(n)
    setSaveStatus('unsaved')
  }

  const handleConfigChange = (cfg: PageConfig) => {
    setPageConfig(cfg)
    setSaveStatus('unsaved')
  }

  // ── DnD handlers ──────────────────────────────────────────────
  const onDragStart = (e: DragStartEvent) => {
    const id = e.active.id as string
    if (id.startsWith('sidebar-')) setDraggedType(id.replace('sidebar-', '') as BlockType)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (draggedType) {
      setDraggedType(null)
      if (over && over.id !== 'canvas-empty') {
        const overId = over.id as string
        const idx = blocks.findIndex(b => b.id === overId)
        addBlock(draggedType, idx >= 0 ? idx : blocks.length)
      } else if (over) {
        addBlock(draggedType)
      }
      return
    }
    if (over && active.id !== over.id) {
      setBlocksAndHistory(prev => {
        const oldIdx = prev.findIndex(b => b.id === active.id)
        const newIdx = prev.findIndex(b => b.id === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  // ── AI generation ──────────────────────────────────────────────
  const generatePage = async (mode: 'full' | 'block') => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError(null)
    try {
      const body = mode === 'block'
        ? { prompt: `Crie APENAS um único bloco para: ${aiPrompt}. Retorne somente 1 bloco no array conteudo.` }
        : { prompt: aiPrompt }
      const res = await fetch('/api/admin/paginas/gerar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error || `Erro ${res.status} — verifique se OPENAI_API_KEY está configurada nas variáveis de ambiente da Vercel.`)
        return
      }
      if (mode === 'full') {
        const newBlocks = data.conteudo || []
        setBlocks(newBlocks)
        history.push(newBlocks)
        if (data.configuracoes) handleConfigChange({ ...pageConfig, ...data.configuracoes })
        if (data.nome) handleNomeChange(data.nome)
      } else {
        const added = data.conteudo?.slice(0, 3) || []
        setBlocksAndHistory(prev => [...prev, ...added])
      }
      setShowAI(false)
      setAiPrompt('')
    } catch (err) {
      setAiError(`Falha de rede: ${String(err)}`)
    } finally { setAiLoading(false) }
  }

  // ── Sidebar filter ─────────────────────────────────────────────
  const filteredMeta = sidebarSearch
    ? BLOCK_META.filter(m => `${m.label} ${m.description}`.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : activeCategory ? BLOCK_META.filter(m => m.category === activeCategory) : BLOCK_META

  const publicUrl = `/p/${slugInicial}`

  const statusLabel = saveStatus === 'saved' ? '✓ Salvo' : saveStatus === 'saving' ? '⏳ Salvando...' : '● Não salvo'
  const statusColor = saveStatus === 'saved' ? '#10b981' : saveStatus === 'saving' ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter,system-ui,sans-serif', background: '#f4f5f7' }}>
      <style>{`
        .builder-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .builder-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,.1); }
        .builder-scroll::-webkit-scrollbar-thumb { background: rgba(120,120,140,.4); border-radius: 4px; }
        .builder-scroll::-webkit-scrollbar-thumb:hover { background: rgba(120,120,140,.7); }
        .builder-scroll { scrollbar-width: thin; scrollbar-color: rgba(120,120,140,.4) transparent; }
      `}</style>

      {/* ══════════ TOOLBAR ══════════ */}
      <div style={{ height: 52, background: '#0f0f1a', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexShrink: 0, borderBottom: '1px solid #1e1e3a', zIndex: 100 }}>
        <a href="/dashboard/paginas" style={{ color: '#666', fontSize: 13, textDecoration: 'none', padding: '4px 8px', borderRadius: 6, flexShrink: 0 }}>← Páginas</a>
        <div style={{ width: 1, height: 20, background: '#1e1e3a' }} />
        <input value={nome} onChange={e => handleNomeChange(e.target.value)}
          style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', width: 200, minWidth: 80 }}
          placeholder="Nome da página" />

        <div style={{ flex: 1 }} />

        {/* Autosave status */}
        <span style={{ fontSize: 11, color: statusColor, fontWeight: 600, flexShrink: 0 }}>{statusLabel}</span>

        {/* Undo/Redo */}
        <div style={{ display: 'flex', gap: 2 }}>
          <TBtn onClick={() => { const p = history.undo(); if (p) { setBlocks(p); setSelected(null) } }} disabled={!history.canUndo} title="Desfazer (Ctrl+Z)">↩</TBtn>
          <TBtn onClick={() => { const p = history.redo(); if (p) { setBlocks(p); setSelected(null) } }} disabled={!history.canRedo} title="Refazer (Ctrl+Y)">↪</TBtn>
        </div>

        {/* Viewport */}
        <div style={{ display: 'flex', background: '#1a1a2e', borderRadius: 8, padding: 2, gap: 1 }}>
          {(['desktop', 'mobile'] as const).map(v => (
            <button key={v} onClick={() => setViewport(v)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', background: viewport === v ? '#3b3b6e' : 'transparent', color: viewport === v ? '#fff' : '#555' }}>
              {v === 'desktop' ? '🖥' : '📱'}
            </button>
          ))}
        </div>

        <TBtn onClick={() => { setShowAI(true); setAiError(null) }} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', borderColor: 'transparent' }}>✨ IA</TBtn>
        <TBtn onClick={() => { setShowVersions(true); loadVersions() }} title="Histórico de versões">🕐</TBtn>
        <TBtn onClick={() => { setShowPreview(true); setPreviewKey(k => k + 1) }} title="Preview isolado">👁</TBtn>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={tbtnStyle as React.CSSProperties}>🔗 Ver</a>
        <button onClick={saveVersion} style={{ ...tbtnStyle as React.CSSProperties, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>💾 Salvar versão</button>
      </div>

      {/* ══════════ MAIN AREA ══════════ */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ══ SIDEBAR ══ */}
          <div style={{ width: 220, background: '#0f0f1a', borderRight: '1px solid #1e1e3a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '10px 10px 0' }}>
              <input value={sidebarSearch} onChange={e => { setSidebarSearch(e.target.value); setActiveCategory(null) }}
                placeholder="🔍 Buscar..."
                style={{ width: '100%', padding: '7px 10px', background: '#1a1a2e', border: '1px solid #1e1e3a', borderRadius: 8, color: '#aaa', fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            {!sidebarSearch && (
              <div style={{ display: 'flex', gap: 3, padding: '8px 10px', flexWrap: 'wrap' }}>
                <CatBtn active={!activeCategory} onClick={() => setActiveCategory(null)}>Todos</CatBtn>
                {BLOCK_CATEGORIES.map(c => <CatBtn key={c.key} active={activeCategory === c.key} onClick={() => setActiveCategory(c.key)}>{c.icon}</CatBtn>)}
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
              <SortableContext items={filteredMeta.map(m => `sidebar-${m.type}`)}>
                {filteredMeta.map(meta => <SidebarItem key={meta.type} meta={meta} onAdd={() => addBlock(meta.type)} />)}
              </SortableContext>
            </div>
            {/* Page colors */}
            <div style={{ borderTop: '1px solid #1e1e3a', padding: 8 }}>
              <button onClick={() => setShowColorPanel(v => !v)} style={{ width: '100%', padding: '7px 10px', background: '#1a1a2e', border: '1px solid #1e1e3a', borderRadius: 8, color: '#777', fontSize: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                🎨 Cores da página {showColorPanel ? '▲' : '▼'}
              </button>
              {showColorPanel && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[{ key: 'primaryColor', label: 'Primária' }, { key: 'backgroundColor', label: 'Fundo' }].map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="color" value={(pageConfig[key as keyof PageConfig] as string) || '#ffffff'}
                        onChange={e => handleConfigChange({ ...pageConfig, [key]: e.target.value })}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 6 }} />
                      <span style={{ fontSize: 11, color: '#666' }}>{label}</span>
                      <input type="text" value={(pageConfig[key as keyof PageConfig] as string) || ''}
                        onChange={e => handleConfigChange({ ...pageConfig, [key]: e.target.value })}
                        style={{ flex: 1, padding: '4px 6px', background: '#1a1a2e', border: '1px solid #1e1e3a', borderRadius: 6, color: '#aaa', fontSize: 11, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ══ CANVAS ══ */}
          <div className="builder-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 12px', background: '#e8eaed', gap: 0 }}
            onClick={() => setSelected(null)}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12, fontWeight: 500, letterSpacing: 0.5, display: 'flex', gap: 16, alignItems: 'center' }}>
              <span>{blocks.length} bloco{blocks.length !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>Ctrl+Z desfazer · Ctrl+S salvar · Del excluir bloco selecionado</span>
            </div>

            <div style={{
              width: viewport === 'mobile' ? 390 : '100%', maxWidth: viewport === 'mobile' ? 390 : 1280,
              background: pageConfig.backgroundColor || '#ffffff',
              borderRadius: viewport === 'mobile' ? 28 : 10,
              boxShadow: '0 2px 40px rgba(0,0,0,.14)',
              overflow: 'hidden', minHeight: 500,
              transition: 'all .3s cubic-bezier(.4,0,.2,1)',
              outline: '3px solid transparent',
            }}>
              {blocks.length === 0 ? (
                <div style={{ padding: 80, textAlign: 'center', color: '#bbb' }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>🎨</div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#888' }}>Página vazia</p>
                  <p style={{ fontSize: 14, marginTop: 8 }}>Arraste blocos da barra lateral ou use ✨ IA para gerar</p>
                </div>
              ) : (
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  {blocks.map((block, idx) => (
                    <CanvasBlock
                      key={block.id}
                      block={block}
                      selected={selected === block.id}
                      isFirst={idx === 0}
                      isLast={idx === blocks.length - 1}
                      onSelect={id => setSelected(selected === id ? null : id)}
                      onDuplicate={duplicateBlock}
                      onDelete={deleteBlock}
                      onMoveUp={id => moveBlock(id, 'up')}
                      onMoveDown={id => moveBlock(id, 'down')}
                    />
                  ))}
                </SortableContext>
              )}
            </div>

            <button onClick={() => { setShowAI(true); setAiError(null) }} style={{ marginTop: 16, padding: '9px 20px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              ✨ Gerar com IA
            </button>
          </div>

          {/* DragOverlay for sidebar items */}
          <DragOverlay>
            {draggedType && (
              <div style={{ padding: '8px 14px', background: '#6366f1', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, opacity: 0.92, boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
                {BLOCK_META.find(m => m.type === draggedType)?.icon} {BLOCK_META.find(m => m.type === draggedType)?.label}
              </div>
            )}
          </DragOverlay>

          {/* ══ PROPERTIES PANEL ══ */}
          <div className="builder-scroll" style={{ width: 268, background: '#0f0f1a', borderLeft: '1px solid #1e1e3a', overflow: 'auto', flexShrink: 0 }}>
            {selectedBlock ? (
              <PropertiesPanel block={selectedBlock} onChange={props => updateBlockProps(selectedBlock.id, props)} />
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#444', marginTop: 64 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👆</div>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>Selecione um bloco para editar suas propriedades</p>
                <p style={{ fontSize: 11, color: '#333', marginTop: 8 }}>{blocks.length} bloco{blocks.length !== 1 ? 's' : ''} na página</p>
              </div>
            )}
          </div>
        </div>
      </DndContext>

      {/* ══ AI MODAL ══ */}
      {showAI && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => !aiLoading && setShowAI(false)}>
          <div style={{ background: '#0f0f1a', borderRadius: 20, padding: 28, width: '100%', maxWidth: 640, border: '1px solid #1e1e3a', boxShadow: '0 32px 100px rgba(0,0,0,.6)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✨</div>
              <div>
                <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>Gerar com IA</h2>
                <p style={{ color: '#666', fontSize: 12, margin: 0 }}>Descreva o que quer — a IA constrói para você</p>
              </div>
              <button onClick={() => { setShowAI(false); setAiError(null) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
            </div>

            {/* Quick prompts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
              {[
                'Landing page de curso de marketing digital com preços e depoimentos',
                'Página de captura para e-book gratuito sobre produtividade',
                'Página de vendas para consultoria com urgência, prova social e garantia',
                'Portfolio pessoal com projetos e formulário de contato',
              ].map(s => (
                <button key={s} onClick={() => setAiPrompt(s)} style={{ padding: '7px 12px', background: '#1a1a2e', border: '1px solid #1e1e3a', borderRadius: 8, color: '#666', fontSize: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color .15s' }}>
                  💡 {s}
                </button>
              ))}
            </div>

            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              placeholder="Ex: Crie uma landing page premium para academia de musculação, com hero impactante, benefícios, depoimentos de alunos, preços mensais e formulário de contato..."
              rows={4}
              style={{ width: '100%', background: '#1a1a2e', border: '1px solid #1e1e3a', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 13, lineHeight: 1.6, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => generatePage('full')} disabled={aiLoading || !aiPrompt.trim()} style={{ flex: 1, padding: '12px', background: aiLoading ? '#333' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, cursor: aiLoading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                {aiLoading ? '⏳ Gerando...' : '🚀 Gerar Página Completa'}
              </button>
              <button onClick={() => generatePage('block')} disabled={aiLoading || !aiPrompt.trim()} style={{ padding: '12px 16px', background: '#1a1a2e', color: '#94a3b8', border: '1px solid #1e1e3a', borderRadius: 10, cursor: aiLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                + 1 Bloco
              </button>
            </div>
            {aiLoading && <p style={{ textAlign: 'center', color: '#666', fontSize: 12, marginTop: 12 }}>🤖 Gerando com GPT-4o... pode levar até 30 segundos</p>}
            {aiError && (
              <div style={{ marginTop: 12, padding: '12px 14px', background: '#2d0a0a', border: '1px solid #7f1d1d', borderRadius: 10 }}>
                <p style={{ color: '#fca5a5', fontSize: 12, margin: 0, lineHeight: 1.6 }}>❌ {aiError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ VERSION HISTORY ══ */}
      {showVersions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowVersions(false)}>
          <div style={{ background: '#0f0f1a', borderRadius: 20, padding: 24, width: '100%', maxWidth: 500, border: '1px solid #1e1e3a', maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>🕐 Histórico de Versões</h2>
              <button onClick={() => setShowVersions(false)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {versoes.length === 0 ? (
              <p style={{ color: '#555', textAlign: 'center', padding: 32 }}>Nenhuma versão salva ainda.<br /><span style={{ fontSize: 12 }}>Use "Salvar versão" para criar um ponto de restauração.</span></p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {versoes.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#1a1a2e', borderRadius: 10, border: '1px solid #1e1e3a' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#ccc', fontSize: 14 }}>{v.nome}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#555' }}>{new Date(v.criado_em).toLocaleString('pt-BR')}</p>
                    </div>
                    <button onClick={() => restoreVersion(v.id)} style={{ padding: '6px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ ISOLATED PREVIEW ══ */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 3000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 48, background: '#0f0f1a', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>👁 Preview — {nome}</span>
            <span style={{ fontSize: 11, color: '#555' }}>Mostrando a versão atualmente salva no banco</span>
            <div style={{ flex: 1 }} />
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ ...tbtnStyle as React.CSSProperties, textDecoration: 'none' }}>Abrir em nova aba ↗</a>
            <button onClick={() => setShowPreview(false)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>✕ Fechar</button>
          </div>
          <iframe
            key={previewKey}
            src={publicUrl}
            style={{ flex: 1, border: 'none', background: '#fff' }}
            title="Preview"
          />
        </div>
      )}
    </div>
  )
}

// ── Sidebar Item ──────────────────────────────────────────────────
const SidebarItem = memo(function SidebarItem({ meta, onAdd }: { meta: BlockMeta; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: `sidebar-${meta.type}` })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onAdd} title={`${meta.label}: ${meta.description}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 8, cursor: 'grab', marginBottom: 1, background: isDragging ? 'rgba(99,102,241,.2)' : 'transparent', border: isDragging ? '1px solid #6366f1' : '1px solid transparent', color: '#bbb', userSelect: 'none', transition: 'background .1s' }}>
      <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{meta.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.3 }}>{meta.label}</div>
        <div style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.description}</div>
      </div>
    </div>
  )
})

// ── Canvas Block ──────────────────────────────────────────────────
interface CBProps {
  block: Block; selected: boolean; isFirst: boolean; isLast: boolean
  onSelect: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void
  onMoveUp: (id: string) => void; onMoveDown: (id: string) => void
}

const CanvasBlock = memo(function CanvasBlock({ block, selected, isFirst, isLast, onSelect, onDuplicate, onDelete, onMoveUp, onMoveDown }: CBProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1, position: 'relative', outline: selected ? '2px solid #6366f1' : '2px solid transparent', outlineOffset: -2, cursor: 'default', background: 'inherit' }}
      onClick={e => { e.stopPropagation(); onSelect(block.id) }}>

      {/* Block type label */}
      {selected && (
        <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 20, background: '#6366f1', color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 1.5, pointerEvents: 'none' }}>
          {block.type}
        </div>
      )}

      {/* Controls */}
      {selected && (
        <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 20, display: 'flex', gap: 3 }}>
          <button {...attributes} {...listeners} style={cb('#6366f1')} title="Arrastar">⠿</button>
          <button onClick={e => { e.stopPropagation(); onMoveUp(block.id) }} disabled={isFirst} style={cb('#334155')} title="↑">↑</button>
          <button onClick={e => { e.stopPropagation(); onMoveDown(block.id) }} disabled={isLast} style={cb('#334155')} title="↓">↓</button>
          <button onClick={e => { e.stopPropagation(); onDuplicate(block.id) }} style={cb('#0f766e')} title="Duplicar">⎘</button>
          <button onClick={e => { e.stopPropagation(); onDelete(block.id) }} style={cb('#dc2626')} title="Excluir">✕</button>
        </div>
      )}

      <BlockRenderer block={block} preview />
    </div>
  )
})

// ── Helpers ────────────────────────────────────────────────────────
function TBtn({ children, onClick, disabled, title, style: s }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{ ...tbtnStyle as React.CSSProperties, ...(disabled ? { opacity: 0.3, cursor: 'not-allowed' } : {}), ...s }}>
      {children}
    </button>
  )
}

function CatBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', background: active ? '#6366f1' : '#1a1a2e', color: active ? '#fff' : '#555' }}>
      {children}
    </button>
  )
}

function cb(bg: string): React.CSSProperties {
  return { width: 26, height: 26, background: bg, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }
}

const tbtnStyle = {
  padding: '5px 12px', background: '#1a1a2e', color: '#888',
  border: '1px solid #1e1e3a', borderRadius: 7, cursor: 'pointer',
  fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none',
}

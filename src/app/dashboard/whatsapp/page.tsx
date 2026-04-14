"use client"

import { useState, useEffect, useRef } from "react"

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Lista = { id: string; nome: string; criado_em: string; total_contatos: number; is_leads?: boolean }
type Contato = {
  id: string; nome: string | null; telefone: string
  dentro_24h?: boolean; ultima_msg_user?: string | null
  pilar_fraco?: string | null; nivel_qs?: string | null; status_lead?: string | null; renda_mensal?: string | null
}
type TipoMsg = "text" | "image" | "audio" | "video" | "document" | "template"

interface MsgItem {
  id: string
  tipo: TipoMsg
  conteudo: string
  variacoes: string[] // variações adicionais de texto (só para tipo=text)
  caption: string
  filename: string
  template_name: string
  template_lang: string
  template_vars: string[]
  template_param_count: number // quantas variáveis o template realmente tem
}

interface TemplateInfo {
  name: string
  language: string
  category: string
  components: Array<{ type: string; text?: string; parameters?: Array<{ type: string }> }>
}

const TIPOS: { value: TipoMsg; label: string; icon: string; accept: string }[] = [
  { value: "template",  label: "Template", icon: "◈",  accept: "" },
  { value: "text",      label: "Texto",    icon: "✉",  accept: "" },
  { value: "image",     label: "Foto",     icon: "🖼",  accept: "image/*" },
  { value: "audio",     label: "Áudio",    icon: "🎵",  accept: "audio/*" },
  { value: "video",     label: "Vídeo",    icon: "🎬",  accept: "video/*" },
  { value: "document",  label: "Documento",icon: "📄",  accept: ".pdf,.doc,.docx,.xls,.xlsx" },
]

function uid() { return Math.random().toString(36).slice(2, 10) }

function normalizarDigito(tel: string, removerNono: boolean): string {
  let d = tel.replace(/\D/g, "")
  if (!d.startsWith("55")) d = "55" + d
  if (removerNono && d.length === 13) {
    d = d.slice(0, 4) + d.slice(5)
  }
  return d
}

function criarMsgVazia(): MsgItem {
  return { id: uid(), tipo: "text", conteudo: "", variacoes: [], caption: "", filename: "", template_name: "", template_lang: "pt_BR", template_vars: [], template_param_count: 0 }
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const [listas, setListas] = useState<Lista[]>([])
  const [listaAtiva, setListaAtiva] = useState<Lista | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [carregando, setCarregando] = useState(false)

  // Nova lista
  const [nomeLista, setNomeLista] = useState("")
  const [criandoLista, setCriandoLista] = useState(false)

  // Adição manual
  const [novoNome, setNovoNome] = useState("")
  const [novoTel, setNovoTel] = useState("")
  const [removerNono, setRemoverNono] = useState(false)
  const [adicionando, setAdicionando] = useState(false)

  // Import CSV/Excel
  const fileImportRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)
  const [importMsg, setImportMsg] = useState("")

  // Templates
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [templateCarregando, setTemplateCarregando] = useState(false)
  const [templateErro, setTemplateErro] = useState("")

  // Filtros (só para lista Leads MS)
  const [filtros, setFiltros] = useState({ pilar: "", nivel: "", status: "", janela: "", renda: "" })
  const [sincronizando, setSincronizando] = useState(false)

  // Fila de mensagens
  const [fila, setFila] = useState<MsgItem[]>([criarMsgVazia()])
  const [uploadandoId, setUploadandoId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const variacaoRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  // Rastreia qual textarea está focado para inserção de variáveis
  const focusedFieldRef = useRef<{ msgId: string; variacaoIdx: number | null }>({ msgId: "", variacaoIdx: null })

  // Disparo
  const [disparando, setDisparando] = useState(false)
  const [disparoResult, setDisparoResult] = useState<{ total: number; enviados: number; falhas: number; erros?: string[] } | null>(null)
  const [disparoErro, setDisparoErro] = useState("")
  const [apiProvider, setApiProvider] = useState<"meta" | "zapi" | "baileys">("meta")

  // Baileys — instâncias
  type BaileysInstancia = { id: string; label: string; status: string; phone: string | null; connected: boolean; qr?: string | null }
  const [baileysInstancias, setBaileysInstancias] = useState<BaileysInstancia[]>([])
  const [baileysInstSelecionada, setBaileysInstSelecionada] = useState<string>("1")
  const [baileysCarregando, setBaileysCarregando] = useState(false)
  const baileysIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Baileys: busca instâncias quando provedor muda ──
  useEffect(() => {
    if (apiProvider !== "baileys") {
      if (baileysIntervalRef.current) clearInterval(baileysIntervalRef.current)
      return
    }
    fetchBaileysInstancias(true) // primeira carga: auto-seleciona
    // Polling a cada 5s — sem auto-selecionar para não mudar a escolha do usuário
    baileysIntervalRef.current = setInterval(() => fetchBaileysInstancias(false), 5000)
    return () => { if (baileysIntervalRef.current) clearInterval(baileysIntervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiProvider])

  async function fetchBaileysInstancias(autoSelect = false) {
    setBaileysCarregando(true)
    try {
      const res = await fetch("/api/admin/wpp/baileys-status")
      if (res.ok) {
        const data = await res.json()
        setBaileysInstancias(data)
        // Auto-seleciona só na primeira carga (quando não há seleção ainda)
        if (autoSelect) {
          const conectada = data.find((i: BaileysInstancia) => i.connected)
          if (conectada) setBaileysInstSelecionada(conectada.id)
        }
      }
    } catch { /* servidor offline */ }
    setBaileysCarregando(false)
  }

  // ── Carrega listas ──
  useEffect(() => { fetchListas() }, [])

  async function fetchListas() {
    const res = await fetch("/api/admin/wpp/listas")
    const data = await res.json()
    setListas(Array.isArray(data) ? data : [])
  }

  async function fetchContatos(listaId: string, f?: typeof filtros) {
    setCarregando(true)
    const p = new URLSearchParams()
    const ff = f ?? filtros
    if (ff.pilar) p.set("filtro_pilar", ff.pilar)
    if (ff.nivel) p.set("filtro_nivel", ff.nivel)
    if (ff.status) p.set("filtro_status", ff.status)
    if (ff.renda) p.set("filtro_renda", ff.renda)
    if (ff.janela) p.set("filtro_janela", ff.janela)
    const qs = p.toString() ? `?${p.toString()}` : ""
    const res = await fetch(`/api/admin/wpp/listas/${listaId}/contatos${qs}`)
    const data = await res.json()
    setContatos(Array.isArray(data) ? data : [])
    setCarregando(false)
  }

  async function sincronizarLeads() {
    setSincronizando(true)
    try {
      await fetch("/api/admin/wpp/sync-leads", { method: "POST" })
      await fetchListas()
      if (listaAtiva?.is_leads) fetchContatos(listaAtiva.id)
    } catch { /* ignore */ }
    setSincronizando(false)
  }

  async function fetchTemplates() {
    setTemplateCarregando(true)
    setTemplateErro("")
    try {
      const res = await fetch("/api/admin/wpp/templates")
      const data = await res.json()
      if (!res.ok) {
        setTemplateErro(data.error ?? "Erro ao carregar templates")
      } else {
        setTemplates(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length === 0) {
          setTemplateErro("Nenhum template encontrado. Verifique o META_WABA_ID nas Integrações.")
        }
      }
    } catch (e) {
      setTemplateErro("Erro de conexão: " + String(e))
    }
    setTemplateCarregando(false)
  }

  function selecionarLista(lista: Lista) {
    setListaAtiva(lista)
    setImportMsg("")
    setDisparoResult(null)
    setDisparoErro("")
    setFiltros({ pilar: "", nivel: "", status: "", janela: "", renda: "" })
    fetchContatos(lista.id)
  }

  // ── CRUD listas ──
  async function criarLista() {
    if (!nomeLista.trim()) return
    setCriandoLista(true)
    const res = await fetch("/api/admin/wpp/listas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeLista.trim() }),
    })
    const data = await res.json()
    setCriandoLista(false)
    if (res.ok) {
      setNomeLista("")
      await fetchListas()
      selecionarLista({ ...data, total_contatos: 0 })
    }
  }

  async function removerLista(id: string) {
    if (!confirm("Remover esta lista e todos os contatos?")) return
    await fetch(`/api/admin/wpp/listas/${id}`, { method: "DELETE" })
    if (listaAtiva?.id === id) { setListaAtiva(null); setContatos([]) }
    fetchListas()
  }

  // ── Contatos ──
  async function adicionarContato() {
    if (!listaAtiva || !novoTel.trim()) return
    setAdicionando(true)
    const tel = normalizarDigito(novoTel, removerNono)
    await fetch(`/api/admin/wpp/listas/${listaAtiva.id}/contatos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contatos: [{ nome: novoNome.trim() || null, telefone: tel }] }),
    })
    setNovoNome("")
    setNovoTel("")
    setAdicionando(false)
    fetchContatos(listaAtiva.id)
    fetchListas()
  }

  async function removerContato(contatoId: string) {
    if (!listaAtiva) return
    await fetch(`/api/admin/wpp/listas/${listaAtiva.id}/contatos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contatoId }),
    })
    setContatos(prev => prev.filter(c => c.id !== contatoId))
    fetchListas()
  }

  // ── Import CSV / Excel ──
  async function importarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !listaAtiva) return
    setImportando(true)
    setImportMsg("")

    try {
      const ext = file.name.split(".").pop()?.toLowerCase()
      let rows: Array<{ nome?: string; telefone: string }> = []

      if (ext === "csv" || ext === "txt") {
        const text = await file.text()
        const lines = text.split(/\r?\n/).filter(l => l.trim())
        const sep = lines[0]?.includes(";") ? ";" : ","
        const hasHeader = /[a-zA-Z]/.test(lines[0]?.split(sep)[0] ?? "")
        const dataLines = hasHeader ? lines.slice(1) : lines
        rows = dataLines
          .map(l => {
            const cols = l.split(sep).map(c => c.replace(/^"|"$/g, "").trim())
            const telIdx = cols.findIndex(c => /\d{8,}/.test(c.replace(/\D/g, "")))
            if (telIdx === -1) return null
            const nomeIdx = telIdx === 0 ? 1 : 0
            return { nome: cols[nomeIdx] || undefined, telefone: cols[telIdx] }
          })
          .filter(Boolean) as Array<{ nome?: string; telefone: string }>
      } else {
        const buf = await file.arrayBuffer()
        // @ts-ignore — xlsx types not resolved on Vercel build
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buf)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[]
        rows = json.map(row => {
          const keys = Object.keys(row)
          const telKey = keys.find(k => /tel|phone|fone|whats|celular|numero|número/i.test(k)) ?? keys[keys.length - 1]
          const nomeKey = keys.find(k => /nome|name/i.test(k)) ?? keys[0]
          return { nome: String(row[nomeKey] || ""), telefone: String(row[telKey] || "") }
        }).filter(r => r.telefone)
      }

      if (rows.length === 0) { setImportMsg("Nenhum telefone encontrado no arquivo."); setImportando(false); return }

      const contatosNorm = rows.map(r => ({
        nome: r.nome || null,
        telefone: normalizarDigito(r.telefone, removerNono),
      })).filter(r => r.telefone.length >= 10)

      const res = await fetch(`/api/admin/wpp/listas/${listaAtiva.id}/contatos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contatos: contatosNorm }),
      })
      const data = await res.json()
      if (res.ok) {
        setImportMsg(`✓ ${data.inseridos} contatos importados com sucesso.`)
        fetchContatos(listaAtiva.id)
        fetchListas()
      } else {
        setImportMsg(`Erro: ${data.error}`)
      }
    } catch (err) {
      setImportMsg(`Erro ao processar arquivo: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImportando(false)
      if (fileImportRef.current) fileImportRef.current.value = ""
    }
  }

  // ── Fila de mensagens ──
  function atualizarMsg(id: string, patch: Partial<MsgItem>) {
    setFila(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  function inserirVariavel(variavel: string) {
    const { msgId, variacaoIdx } = focusedFieldRef.current
    const msg = fila.find(m => m.id === msgId)
    if (!msg) return

    const el = variacaoIdx === null
      ? textareaRefs.current[msgId]
      : variacaoRefs.current[`${msgId}_${variacaoIdx}`]

    const textoAtual = variacaoIdx === null ? msg.conteudo : (msg.variacoes[variacaoIdx] ?? "")
    const start = el?.selectionStart ?? textoAtual.length
    const end = el?.selectionEnd ?? textoAtual.length
    const novo = textoAtual.slice(0, start) + variavel + textoAtual.slice(end)

    if (variacaoIdx === null) {
      atualizarMsg(msgId, { conteudo: novo })
    } else {
      const novasVars = [...msg.variacoes]
      novasVars[variacaoIdx] = novo
      atualizarMsg(msgId, { variacoes: novasVars })
    }

    setTimeout(() => {
      el?.setSelectionRange(start + variavel.length, start + variavel.length)
      el?.focus()
    }, 0)
  }

  function adicionarVariacao(msgId: string) {
    const msg = fila.find(m => m.id === msgId)
    if (!msg) return
    atualizarMsg(msgId, { variacoes: [...msg.variacoes, ""] })
  }

  function atualizarVariacao(msgId: string, idx: number, texto: string) {
    const msg = fila.find(m => m.id === msgId)
    if (!msg) return
    const novas = [...msg.variacoes]
    novas[idx] = texto
    atualizarMsg(msgId, { variacoes: novas })
  }

  function removerVariacao(msgId: string, idx: number) {
    const msg = fila.find(m => m.id === msgId)
    if (!msg) return
    atualizarMsg(msgId, { variacoes: msg.variacoes.filter((_, i) => i !== idx) })
  }

  function adicionarMsgNaFila() {
    setFila(prev => [...prev, criarMsgVazia()])
  }

  function removerMsgDaFila(id: string) {
    setFila(prev => prev.length <= 1 ? prev : prev.filter(m => m.id !== id))
  }

  function moverMsg(id: string, dir: -1 | 1) {
    setFila(prev => {
      const idx = prev.findIndex(m => m.id === id)
      if (idx < 0) return prev
      const novoIdx = idx + dir
      if (novoIdx < 0 || novoIdx >= prev.length) return prev
      const nova = [...prev]
      ;[nova[idx], nova[novoIdx]] = [nova[novoIdx], nova[idx]]
      return nova
    })
  }

  async function uploadMidia(msgId: string, file: File) {
    setUploadandoId(msgId)
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/admin/wpp/upload", { method: "POST", body: form })
    const data = await res.json()
    setUploadandoId(null)
    if (res.ok) {
      atualizarMsg(msgId, { conteudo: data.url, filename: data.filename })
    }
  }

  // ── Disparar ──
  async function disparar() {
    if (!listaAtiva || fila.length === 0) return
    setDisparando(true)
    setDisparoResult(null)
    setDisparoErro("")

    const mensagens = fila.map(m => {
      if (m.tipo === "template") {
        return {
          tipo: "template" as const,
          template_name: m.template_name,
          template_lang: m.template_lang || "pt_BR",
          template_vars: m.template_vars.filter(v => v.trim()),
          template_param_count: m.template_param_count ?? 0,
        }
      }
      return {
        tipo: m.tipo,
        conteudo: m.conteudo,
        variacoes: m.tipo === "text" && m.variacoes.length > 0 ? m.variacoes : undefined,
        caption: m.caption || undefined,
        filename: m.filename || undefined,
      }
    })

    const res = await fetch("/api/admin/wpp/disparar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lista_id: listaAtiva.id, mensagens, filtros: listaAtiva.is_leads ? filtros : undefined, api_provider: apiProvider, baileys_instance_id: baileysInstSelecionada }),

    })
    const data = await res.json()
    setDisparando(false)
    if (res.ok) {
      setDisparoResult({ total: data.total, enviados: data.enviados, falhas: data.falhas, erros: data.erros })
    } else {
      setDisparoErro(data.error || "Erro ao disparar")
    }
  }

  // Valida se a fila pode ser disparada
  const filaValida = fila.every(m => {
    if (m.tipo === "template") return !!m.template_name
    if (m.tipo === "text") return m.conteudo.trim().length > 0
    return m.conteudo.length > 0 // URL da mídia
  })
  const podeDisparar = listaAtiva && contatos.length > 0 && filaValida && !disparando

  return (
    <>
      <style>{css}</style>
      <div className="wpp-layout">

        {/* ── Sidebar: listas ── */}
        <aside className="wpp-sidebar">
          <div className="wpp-sidebar-header">
            <h2 className="wpp-sidebar-title">Listas de Contatos</h2>
          </div>

          <div className="wpp-nova-lista">
            <input
              className="wpp-input"
              placeholder="Nome da lista..."
              value={nomeLista}
              onChange={e => setNomeLista(e.target.value)}
              onKeyDown={e => e.key === "Enter" && criarLista()}
            />
            <button className="wpp-btn wpp-btn-gold" onClick={criarLista} disabled={!nomeLista.trim() || criandoLista}>
              {criandoLista ? "..." : "+"}
            </button>
          </div>

          <div style={{ padding: "8px 12px 0" }}>
            <button
              className="wpp-btn wpp-btn-outline wpp-btn-full"
              onClick={sincronizarLeads}
              disabled={sincronizando}
              style={{ fontSize: 11 }}
            >
              {sincronizando ? "Sincronizando..." : "Sincronizar Leads"}
            </button>
          </div>

          <div className="wpp-listas-list">
            {listas.length === 0 && <p className="wpp-empty">Nenhuma lista criada</p>}
            {listas.map(l => (
              <div
                key={l.id}
                className={`wpp-lista-item${listaAtiva?.id === l.id ? " active" : ""}`}
                onClick={() => selecionarLista(l)}
              >
                <div className="wpp-lista-info">
                  <span className="wpp-lista-nome">
                    {l.nome}
                    {l.is_leads && <span className="wpp-badge-leads">AUTO</span>}
                  </span>
                  <span className="wpp-lista-total">{l.total_contatos} contato{l.total_contatos !== 1 ? "s" : ""}</span>
                </div>
                {!l.is_leads && (
                  <button
                    className="wpp-icon-btn wpp-icon-del"
                    onClick={e => { e.stopPropagation(); removerLista(l.id) }}
                    title="Remover lista"
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="wpp-main">
          {!listaAtiva ? (
            <div className="wpp-empty-state">
              <div className="wpp-empty-icon">◈</div>
              <p className="wpp-empty-title">Selecione ou crie uma lista</p>
              <p className="wpp-empty-sub">Importe contatos via CSV/Excel ou adicione manualmente, depois dispare mensagens para toda a lista.</p>
            </div>
          ) : (
            <>
              <div className="wpp-main-header">
                <h1 className="wpp-main-title">{listaAtiva.nome}</h1>
                <span className="wpp-main-count">{contatos.length} contato{contatos.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="wpp-content-grid">

                {/* ── Coluna esquerda: contatos ── */}
                <div className="wpp-col">

                  <div className="wpp-card">
                    <div className="wpp-card-title">Importar Contatos</div>
                    <div className="wpp-opcao-remover">
                      <label className="wpp-check-label">
                        <input type="checkbox" checked={removerNono} onChange={e => setRemoverNono(e.target.checked)} />
                        <span>Remover 9o dígito (números com 9 na frente)</span>
                      </label>
                    </div>
                    <div className="wpp-import-btns">
                      <input
                        ref={fileImportRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.txt"
                        style={{ display: "none" }}
                        onChange={importarArquivo}
                      />
                      <button
                        className="wpp-btn wpp-btn-outline"
                        onClick={() => fileImportRef.current?.click()}
                        disabled={importando}
                      >
                        {importando ? "Importando..." : "Importar CSV / Excel"}
                      </button>
                    </div>
                    {importMsg && (
                      <p className={`wpp-import-msg${importMsg.startsWith("✓") ? " ok" : " erro"}`}>{importMsg}</p>
                    )}
                    <p className="wpp-import-hint">
                      O arquivo deve ter colunas de nome e telefone. O sistema detecta automaticamente o formato.
                    </p>
                  </div>

                  <div className="wpp-card">
                    <div className="wpp-card-title">Adicionar Manualmente</div>
                    <div className="wpp-form-row">
                      <input
                        className="wpp-input"
                        placeholder="Nome (opcional)"
                        value={novoNome}
                        onChange={e => setNovoNome(e.target.value)}
                      />
                      <input
                        className="wpp-input"
                        placeholder="Telefone com DDD e DDI (ex: 5511999...)"
                        value={novoTel}
                        onChange={e => setNovoTel(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && adicionarContato()}
                      />
                      <button
                        className="wpp-btn wpp-btn-gold"
                        onClick={adicionarContato}
                        disabled={!novoTel.trim() || adicionando}
                      >
                        {adicionando ? "..." : "Adicionar"}
                      </button>
                    </div>
                  </div>

                  <div className="wpp-card wpp-card-contatos">
                    <div className="wpp-card-title">Contatos da Lista ({contatos.length})</div>

                    {/* Filtros — só para lista de leads */}
                    {listaAtiva.is_leads && (
                      <div className="wpp-filtros">
                        <div className="wpp-filtros-row">
                          <select className="wpp-select" value={filtros.pilar} onChange={e => { const f = { ...filtros, pilar: e.target.value }; setFiltros(f); fetchContatos(listaAtiva.id, f) }}>
                            <option value="">Todos os pilares</option>
                            {["Sociabilidade","Comunicação","Relacionamento","Persuasão","Influência"].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <select className="wpp-select" value={filtros.nivel} onChange={e => { const f = { ...filtros, nivel: e.target.value }; setFiltros(f); fetchContatos(listaAtiva.id, f) }}>
                            <option value="">Todos os níveis</option>
                            {["Negligente","Iniciante","Intermediário","Avançado","Mestre"].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <select className="wpp-select" value={filtros.status} onChange={e => { const f = { ...filtros, status: e.target.value }; setFiltros(f); fetchContatos(listaAtiva.id, f) }}>
                            <option value="">Todos os status</option>
                            {["frio","morno","quente"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <select className="wpp-select" value={filtros.renda} onChange={e => { const f = { ...filtros, renda: e.target.value }; setFiltros(f); fetchContatos(listaAtiva.id, f) }}>
                            <option value="">Todas as rendas</option>
                            {["Até R$ 3.000","R$ 3.000 – R$ 7.000","R$ 7.000 – R$ 15.000","R$ 15.000 – R$ 30.000","Acima de R$ 30.000"].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <select className="wpp-select" value={filtros.janela} onChange={e => { const f = { ...filtros, janela: e.target.value }; setFiltros(f); fetchContatos(listaAtiva.id, f) }}>
                            <option value="">Janela 24h: todos</option>
                            <option value="dentro">- 24h (conversou recente)</option>
                            <option value="fora">+ 24h (sem conversa)</option>
                          </select>
                        </div>
                        {(filtros.pilar || filtros.nivel || filtros.status || filtros.janela || filtros.renda) && (
                          <button
                            className="wpp-btn-limpar"
                            onClick={() => { const f = { pilar: "", nivel: "", status: "", janela: "", renda: "" }; setFiltros(f); fetchContatos(listaAtiva.id, f) }}
                          >Limpar filtros</button>
                        )}
                      </div>
                    )}

                    {carregando && <p className="wpp-empty">Carregando...</p>}
                    {!carregando && contatos.length === 0 && (
                      <p className="wpp-empty">Nenhum contato encontrado{(filtros.pilar || filtros.nivel || filtros.status || filtros.janela) ? " com esses filtros" : ". Importe ou adicione manualmente."}.</p>
                    )}
                    {!carregando && contatos.length > 0 && (
                      <div className="wpp-contatos-list">
                        {contatos.map(c => (
                          <div key={c.id} className="wpp-contato-row">
                            <div className="wpp-contato-info">
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {c.nome && <span className="wpp-contato-nome">{c.nome}</span>}
                                {c.dentro_24h !== undefined && (
                                  <span className={`wpp-badge-24h ${c.dentro_24h ? "dentro" : "fora"}`}>
                                    {c.dentro_24h ? "- 24h" : "+ 24h"}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span className="wpp-contato-tel">{c.telefone}</span>
                                {c.pilar_fraco && <span className="wpp-contato-tag">{c.pilar_fraco}</span>}
                                {c.nivel_qs && <span className="wpp-contato-tag">{c.nivel_qs}</span>}
                                {c.status_lead && <span className="wpp-contato-tag st">{c.status_lead}</span>}
                                {c.renda_mensal && <span className="wpp-contato-tag">{c.renda_mensal}</span>}
                              </div>
                            </div>
                            <button
                              className="wpp-icon-btn wpp-icon-del"
                              onClick={() => removerContato(c.id)}
                              title="Remover"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Coluna direita: fila de disparo ── */}
                <div className="wpp-col">
                  <div className="wpp-card">
                    <div className="wpp-card-title-row">
                      <div className="wpp-card-title" style={{ marginBottom: 0 }}>Fila de Mensagens</div>
                      <span className="wpp-fila-count">{fila.length} {fila.length === 1 ? "mensagem" : "mensagens"}</span>
                    </div>
                    <p className="wpp-fila-hint">
                      Monte a sequência de mensagens. Cada contato receberá todas na ordem. Use <strong>Template</strong> para enviar fora da janela de 24h.
                    </p>

                    {/* Mensagens da fila */}
                    <div className="wpp-fila">
                      {fila.map((msg, idx) => (
                        <div key={msg.id} className="wpp-fila-item">
                          <div className="wpp-fila-header">
                            <span className="wpp-fila-num">{idx + 1}</span>

                            {/* Tipo */}
                            <select
                              className="wpp-select"
                              value={msg.tipo}
                              onChange={e => atualizarMsg(msg.id, {
                                tipo: e.target.value as TipoMsg,
                                conteudo: "", caption: "", filename: "",
                                template_name: "", template_vars: [],
                              })}
                            >
                              {TIPOS.map(t => (
                                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                              ))}
                            </select>

                            {/* Mover / Remover */}
                            <div className="wpp-fila-actions">
                              <button className="wpp-icon-btn-sm" onClick={() => moverMsg(msg.id, -1)} disabled={idx === 0} title="Mover acima">▲</button>
                              <button className="wpp-icon-btn-sm" onClick={() => moverMsg(msg.id, 1)} disabled={idx === fila.length - 1} title="Mover abaixo">▼</button>
                              <button className="wpp-icon-btn-sm wpp-icon-del" onClick={() => removerMsgDaFila(msg.id)} disabled={fila.length <= 1} title="Remover">✕</button>
                            </div>
                          </div>

                          {/* Conteúdo por tipo */}
                          <div className="wpp-fila-body">
                            {msg.tipo === "template" && (
                              <>
                                <div className="wpp-field">
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <select
                                      className="wpp-select wpp-select-full"
                                      value={msg.template_name}
                                      onChange={e => {
                                        const nome = e.target.value
                                        const tpl = templates.find(t => t.name === nome)
                                        // Conta quantas variáveis {{N}} o template tem no body
                                        let paramCount = 0
                                        if (tpl) {
                                          const body = tpl.components.find(c => c.type === "BODY")
                                          if (body?.text) {
                                            const matches = body.text.match(/\{\{\d+\}\}/g)
                                            paramCount = matches ? matches.length : 0
                                          }
                                        }
                                        atualizarMsg(msg.id, { template_name: nome, template_param_count: paramCount, template_lang: tpl?.language || "pt_BR" })
                                      }}
                                    >
                                      <option value="">Selecione um template...</option>
                                      {templates.map(t => (
                                        <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                                      ))}
                                    </select>
                                    <button
                                      className="wpp-btn wpp-btn-outline"
                                      onClick={fetchTemplates}
                                      disabled={templateCarregando}
                                      style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                                    >
                                      {templateCarregando ? "..." : "Carregar"}
                                    </button>
                                  </div>
                                  {templateErro && (
                                    <p style={{ fontSize: "11px", color: "#e07070", marginTop: "4px" }}>{templateErro}</p>
                                  )}
                                </div>
                                <div className="wpp-field">
                                  <label className="wpp-label">Idioma</label>
                                  <input
                                    className="wpp-input"
                                    value={msg.template_lang}
                                    onChange={e => atualizarMsg(msg.id, { template_lang: e.target.value })}
                                    placeholder="pt_BR"
                                  />
                                </div>
                                <div className="wpp-field">
                                  <label className="wpp-label">Variáveis (separadas por vírgula)</label>
                                  <input
                                    className="wpp-input"
                                    placeholder="Ex: João, 25/04"
                                    value={msg.template_vars.join(", ")}
                                    onChange={e => atualizarMsg(msg.id, { template_vars: e.target.value.split(",").map(v => v.trim()) })}
                                  />
                                </div>
                              </>
                            )}

                            {msg.tipo === "text" && (
                              <>
                                <div className="wpp-variacoes-row">
                                  {/* Variação principal */}
                                  <div className="wpp-variacao-col">
                                    {msg.variacoes.length > 0 && (
                                      <div className="wpp-variacao-label">Variação 1</div>
                                    )}
                                    <textarea
                                      ref={el => { textareaRefs.current[msg.id] = el }}
                                      className="wpp-textarea"
                                      rows={3}
                                      placeholder="Digite sua mensagem..."
                                      value={msg.conteudo}
                                      onFocus={() => { focusedFieldRef.current = { msgId: msg.id, variacaoIdx: null } }}
                                      onChange={e => atualizarMsg(msg.id, { conteudo: e.target.value })}
                                    />
                                  </div>

                                  {/* Variações adicionais */}
                                  {msg.variacoes.map((v, vi) => (
                                    <div key={vi} className="wpp-variacao-col">
                                      <div className="wpp-variacao-label">
                                        <span>Variação {vi + 2}</span>
                                        <button
                                          className="wpp-icon-btn-sm wpp-icon-del"
                                          onClick={() => removerVariacao(msg.id, vi)}
                                          title="Remover variação"
                                        >✕</button>
                                      </div>
                                      <textarea
                                        ref={el => { variacaoRefs.current[`${msg.id}_${vi}`] = el }}
                                        className="wpp-textarea"
                                        rows={3}
                                        placeholder={`Variação ${vi + 2}...`}
                                        value={v}
                                        onFocus={() => { focusedFieldRef.current = { msgId: msg.id, variacaoIdx: vi } }}
                                        onChange={e => atualizarVariacao(msg.id, vi, e.target.value)}
                                      />
                                    </div>
                                  ))}
                                </div>

                                {/* Chips + botão adicionar variação */}
                                <div className="wpp-vars-footer">
                                  <div className="wpp-vars-row">
                                    {[
                                      { label: "Nome", var: "{{nome}}" },
                                      { label: "Pilar", var: "{{pilar}}" },
                                      { label: "Nível", var: "{{nivel}}" },
                                      { label: "Renda", var: "{{renda}}" },
                                      { label: "Score", var: "{{score}}" },
                                      { label: "Status", var: "{{status}}" },
                                    ].map(v => (
                                      <button
                                        key={v.var}
                                        type="button"
                                        className="wpp-var-chip"
                                        onClick={() => inserirVariavel(v.var)}
                                        title={`Inserir ${v.var}`}
                                      >
                                        {v.label}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    className="wpp-add-variacao"
                                    onClick={() => adicionarVariacao(msg.id)}
                                    title="Adicionar variação de texto"
                                  >
                                    + Variação
                                  </button>
                                </div>
                              </>
                            )}

                            {(msg.tipo === "image" || msg.tipo === "audio" || msg.tipo === "video" || msg.tipo === "document") && (
                              <>
                                <input
                                  ref={el => { fileRefs.current[msg.id] = el }}
                                  type="file"
                                  accept={TIPOS.find(t => t.value === msg.tipo)?.accept ?? ""}
                                  style={{ display: "none" }}
                                  onChange={e => {
                                    const f = e.target.files?.[0]
                                    if (f) uploadMidia(msg.id, f)
                                  }}
                                />
                                {msg.conteudo ? (
                                  <div className="wpp-media-preview">
                                    <span className="wpp-media-name">✓ {msg.filename || "Arquivo"}</span>
                                    <button
                                      className="wpp-icon-btn wpp-icon-del"
                                      onClick={() => atualizarMsg(msg.id, { conteudo: "", filename: "" })}
                                    >✕</button>
                                  </div>
                                ) : (
                                  <button
                                    className="wpp-btn wpp-btn-outline wpp-btn-full"
                                    onClick={() => fileRefs.current[msg.id]?.click()}
                                    disabled={uploadandoId === msg.id}
                                  >
                                    {uploadandoId === msg.id ? "Enviando..." : `Selecionar ${TIPOS.find(t => t.value === msg.tipo)?.label}`}
                                  </button>
                                )}

                                {(msg.tipo === "image" || msg.tipo === "video" || msg.tipo === "document") && (
                                  <input
                                    className="wpp-input"
                                    placeholder="Legenda (opcional)"
                                    value={msg.caption}
                                    onChange={e => atualizarMsg(msg.id, { caption: e.target.value })}
                                    style={{ marginTop: 8 }}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Adicionar mais */}
                    <button className="wpp-btn wpp-btn-outline wpp-btn-full" onClick={adicionarMsgNaFila} style={{ marginTop: 12 }}>
                      + Adicionar outra mensagem
                    </button>

                    {/* Seletor de provedor */}
                    <div className="wpp-provider-selector">
                      <span className="wpp-label" style={{ marginBottom: 0 }}>Enviar via:</span>
                      <button
                        className={`wpp-provider-btn ${apiProvider === "meta" ? "active" : ""}`}
                        onClick={() => setApiProvider("meta")}
                        title="Meta Cloud API (oficial) — requer janela 24h para msgs livres"
                      >
                        📱 Meta API
                      </button>
                      <button
                        className={`wpp-provider-btn ${apiProvider === "zapi" ? "active" : ""}`}
                        onClick={() => setApiProvider("zapi")}
                        title="Z-API — sem restrição de janela 24h, envia qualquer tipo de mensagem"
                      >
                        ⚡ Z-API
                      </button>
                      <button
                        className={`wpp-provider-btn ${apiProvider === "baileys" ? "active" : ""}`}
                        onClick={() => setApiProvider("baileys")}
                        title="Baileys local — servidor Node.js na sua máquina, sem restrição de janela 24h"
                      >
                        🟢 Baileys
                      </button>
                      {apiProvider !== "meta" && (
                        <span style={{ fontSize: 11, color: "#c2904d", marginLeft: 4 }}>Sem restrição 24h</span>
                      )}
                    </div>

                    {/* Seletor de instância Baileys */}
                    {apiProvider === "baileys" && (
                      <div className="wpp-baileys-panel">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span className="wpp-label" style={{ marginBottom: 0 }}>Número para disparar:</span>
                          <button
                            className="wpp-btn wpp-btn-outline"
                            style={{ padding: "3px 10px", fontSize: 11 }}
                            onClick={() => fetchBaileysInstancias(false)}
                            disabled={baileysCarregando}
                          >
                            {baileysCarregando ? "..." : "↻ Atualizar"}
                          </button>
                        </div>

                        {baileysInstancias.length === 0 ? (
                          <p style={{ fontSize: 12, color: "#5a4e3e" }}>
                            {baileysCarregando ? "Verificando servidor..." : "Servidor Baileys offline ou BAILEYS_API_URL não configurada."}
                          </p>
                        ) : (
                          <div className="wpp-inst-list">
                            {baileysInstancias.map(inst => (
                              <div
                                key={inst.id}
                                className={`wpp-inst-row ${baileysInstSelecionada === inst.id ? "selected" : ""} ${!inst.connected ? "disabled" : ""}`}
                                onClick={() => inst.connected && setBaileysInstSelecionada(inst.id)}
                              >
                                <div className="wpp-inst-info">
                                  <span className={`wpp-inst-dot ${inst.connected ? "on" : inst.status === "aguardando_qr" ? "qr" : "off"}`} />
                                  <div>
                                    <div className="wpp-inst-label">{inst.label}</div>
                                    <div className="wpp-inst-sub">
                                      {inst.connected
                                        ? `+${inst.phone}`
                                        : inst.status === "aguardando_qr"
                                          ? "Aguardando QR code"
                                          : inst.status === "iniciando"
                                            ? "Iniciando..."
                                            : "Desconectado"}
                                    </div>
                                  </div>
                                </div>
                                {inst.connected && (
                                  <div className={`wpp-inst-radio ${baileysInstSelecionada === inst.id ? "checked" : ""}`} />
                                )}
                                {inst.qr && (
                                  <div className="wpp-inst-qr">
                                    <p style={{ fontSize: 11, color: "#c2904d", marginBottom: 6 }}>Escaneie com o WhatsApp:</p>
                                    <img src={inst.qr} alt="QR Code" style={{ width: 160, height: 160, borderRadius: 8 }} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resumo e botão de disparo */}
                    <div className="wpp-disparo-footer">
                      <div className="wpp-disparo-info">
                        <span className="wpp-disparo-tag">◈ {listaAtiva.nome}</span>
                        <span className="wpp-disparo-count">
                          {contatos.length} destinatário{contatos.length !== 1 ? "s" : ""} × {fila.length} msg{fila.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <button
                        className="wpp-btn wpp-btn-disparo"
                        onClick={disparar}
                        disabled={!podeDisparar}
                      >
                        {disparando
                          ? `Enviando... (pode demorar)`
                          : `Disparar ${fila.length} mensagem${fila.length !== 1 ? "s" : ""} para ${contatos.length} contato${contatos.length !== 1 ? "s" : ""}`}
                      </button>
                    </div>

                    {disparoResult && (
                      <div className="wpp-result ok">
                        <strong>Disparo concluído!</strong><br />
                        ✓ {disparoResult.enviados} enviados · {disparoResult.falhas} falhas · {disparoResult.total} total
                        {disparoResult.erros && disparoResult.erros.length > 0 && (
                          <details style={{ marginTop: 8 }}>
                            <summary style={{ cursor: "pointer", fontSize: 12 }}>Ver erros ({disparoResult.erros.length})</summary>
                            <pre style={{ fontSize: 11, marginTop: 6, whiteSpace: "pre-wrap", color: "#e07070" }}>
                              {disparoResult.erros.join("\n")}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                    {disparoErro && (
                      <div className="wpp-result erro">{disparoErro}</div>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const css = `
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

  /* Scrollbar elegante global */
  .wpp-layout *::-webkit-scrollbar { width:4px; height:4px; }
  .wpp-layout *::-webkit-scrollbar-track { background:transparent; }
  .wpp-layout *::-webkit-scrollbar-thumb { background:rgba(194,144,77,.2); border-radius:99px; }
  .wpp-layout *::-webkit-scrollbar-thumb:hover { background:rgba(194,144,77,.4); }
  .wpp-layout * { scrollbar-width:thin; scrollbar-color:rgba(194,144,77,.2) transparent; }

  .wpp-layout { display:flex; height:calc(100vh - 0px); overflow:hidden; }

  /* Sidebar */
  .wpp-sidebar { width:260px; flex-shrink:0; background:#111009; border-right:1px solid #2a1f18; display:flex; flex-direction:column; overflow:hidden; }
  .wpp-sidebar-header { padding:20px 16px 12px; border-bottom:1px solid #2a1f18; }
  .wpp-sidebar-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:18px; color:#fff9e6; }
  .wpp-nova-lista { display:flex; gap:6px; padding:12px; border-bottom:1px solid #2a1f18; }
  .wpp-listas-list { flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:4px; }
  .wpp-lista-item { display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:10px; cursor:pointer; border:1px solid transparent; transition:all .15s; }
  .wpp-lista-item:hover { background:rgba(255,255,255,.04); }
  .wpp-lista-item.active { background:rgba(194,144,77,.1); border-color:rgba(194,144,77,.2); }
  .wpp-lista-info { flex:1; min-width:0; }
  .wpp-lista-nome { display:block; font-size:13px; font-weight:600; color:#fff9e6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .wpp-lista-total { font-size:11px; color:#4a3e30; }

  /* Main */
  .wpp-main { flex:1; overflow-y:auto; background:#0e0f09; padding:32px; }
  .wpp-main-header { display:flex; align-items:baseline; gap:14px; margin-bottom:24px; }
  .wpp-main-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:28px; color:#fff9e6; }
  .wpp-main-count { font-size:13px; color:#4a3e30; }

  .wpp-empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh; gap:12px; }
  .wpp-empty-icon { font-size:40px; color:#2a1f18; }
  .wpp-empty-title { font-size:17px; font-weight:600; color:#4a3e30; }
  .wpp-empty-sub { font-size:13px; color:#3a2e20; text-align:center; max-width:380px; line-height:1.6; }
  .wpp-empty { font-size:13px; color:#4a3e30; padding:8px 0; }

  /* Grid */
  .wpp-content-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
  .wpp-col { display:flex; flex-direction:column; gap:14px; }

  /* Card */
  .wpp-card { background:#1a1410; border:1px solid #2a1f18; border-radius:14px; padding:20px; }
  .wpp-card-title { font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#c2904d; margin-bottom:14px; }
  .wpp-card-title-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
  .wpp-card-contatos { max-height:380px; display:flex; flex-direction:column; }
  .wpp-contatos-list { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:6px; margin-top:4px; }
  .wpp-contato-row { display:flex; align-items:center; gap:8px; padding:8px 10px; background:rgba(255,255,255,.02); border:1px solid #2a1f18; border-radius:8px; }
  .wpp-contato-info { flex:1; min-width:0; }
  .wpp-contato-nome { display:block; font-size:12px; color:#fff9e6; font-weight:500; }
  .wpp-contato-tel { font-size:12px; color:#4a3e30; font-family:monospace; }

  /* Formulários */
  .wpp-form-row { display:flex; flex-direction:column; gap:8px; }
  .wpp-field { display:flex; flex-direction:column; gap:6px; }
  .wpp-label { font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#4a3e30; }
  .wpp-input { background:#0e0f09; border:1px solid #2a1f18; border-radius:8px; padding:9px 12px; color:#fff9e6; font-size:13px; font-family:inherit; outline:none; width:100%; transition:border-color .15s; }
  .wpp-input:focus { border-color:rgba(194,144,77,.35); }
  .wpp-textarea { background:#0e0f09; border:1px solid #2a1f18; border-radius:8px; padding:10px 12px; color:#fff9e6; font-size:14px; font-family:inherit; outline:none; width:100%; resize:vertical; line-height:1.6; transition:border-color .15s; }
  .wpp-textarea:focus { border-color:rgba(194,144,77,.35); }
  .wpp-variacoes-row { display:flex; gap:8px; align-items:flex-start; }
  .wpp-variacao-col { flex:1; min-width:140px; display:flex; flex-direction:column; gap:4px; }
  .wpp-variacao-label { font-size:10px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:#4a3e30; display:flex; justify-content:space-between; align-items:center; }
  .wpp-vars-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:6px; flex-wrap:wrap; }
  .wpp-vars-row { display:flex; flex-wrap:wrap; gap:6px; }
  .wpp-var-chip { padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; border:1px solid rgba(194,144,77,.3); background:rgba(194,144,77,.06); color:#c2904d; transition:all .15s; letter-spacing:.3px; }
  .wpp-var-chip:hover { background:rgba(194,144,77,.15); border-color:#c2904d; }
  .wpp-add-variacao { padding:3px 12px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; border:1px dashed rgba(194,144,77,.4); background:transparent; color:#c2904d; white-space:nowrap; flex-shrink:0; transition:all .15s; }
  .wpp-add-variacao:hover { background:rgba(194,144,77,.08); border-style:solid; }
  .wpp-select { background:#0e0f09; border:1px solid #2a1f18; border-radius:8px; padding:8px 10px; color:#fff9e6; font-size:12px; font-family:inherit; outline:none; cursor:pointer; }
  .wpp-select:focus { border-color:rgba(194,144,77,.35); }
  .wpp-select-full { width:100%; }

  /* Fila de mensagens */
  .wpp-fila-count { font-size:12px; color:#4a3e30; }
  .wpp-fila-hint { font-size:12px; color:#5a4e3e; line-height:1.5; margin-bottom:14px; }
  .wpp-fila-hint strong { color:#c2904d; }
  .wpp-fila { display:flex; flex-direction:column; gap:10px; }
  .wpp-fila-item { background:rgba(255,255,255,.02); border:1px solid #2a1f18; border-radius:10px; padding:12px; }
  .wpp-fila-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .wpp-fila-num { width:22px; height:22px; display:flex; align-items:center; justify-content:center; background:rgba(194,144,77,.12); color:#c2904d; font-size:11px; font-weight:700; border-radius:6px; flex-shrink:0; }
  .wpp-fila-actions { display:flex; gap:4px; margin-left:auto; }
  .wpp-fila-body { display:flex; flex-direction:column; gap:8px; }

  .wpp-icon-btn-sm { background:transparent; border:1px solid #2a1f18; color:#4a3e30; width:24px; height:24px; border-radius:5px; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center; font-family:inherit; transition:all .15s; }
  .wpp-icon-btn-sm:hover:not(:disabled) { border-color:rgba(194,144,77,.3); color:#c2904d; }
  .wpp-icon-btn-sm:disabled { opacity:.3; cursor:default; }
  .wpp-icon-btn-sm.wpp-icon-del:hover:not(:disabled) { border-color:rgba(224,100,80,.3); color:#e07070; }

  /* Upload mídia */
  .wpp-media-preview { display:flex; align-items:center; gap:8px; padding:10px 12px; background:rgba(194,144,77,.06); border:1px solid rgba(194,144,77,.2); border-radius:8px; }
  .wpp-media-name { flex:1; font-size:13px; color:#c2904d; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  /* Disparo footer */
  .wpp-provider-selector { display:flex; align-items:center; gap:8px; margin-top:16px; padding:10px 12px; background:rgba(194,144,77,.04); border:1px solid rgba(194,144,77,.12); border-radius:8px; }
  .wpp-provider-btn { padding:5px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; border:1px solid rgba(194,144,77,.25); background:transparent; color:#7a6a58; transition:all .15s; }
  .wpp-provider-btn.active { background:rgba(194,144,77,.15); border-color:#c2904d; color:#c2904d; }

  /* Baileys instâncias */
  .wpp-baileys-panel { margin-top:10px; padding:12px 14px; background:rgba(255,255,255,.02); border:1px solid #2a1f18; border-radius:10px; }
  .wpp-inst-list { display:flex; flex-direction:column; gap:8px; }
  .wpp-inst-row { padding:10px 12px; border:1px solid #2a1f18; border-radius:8px; cursor:pointer; transition:all .15s; }
  .wpp-inst-row:hover:not(.disabled) { border-color:rgba(194,144,77,.3); background:rgba(194,144,77,.04); }
  .wpp-inst-row.selected { border-color:#c2904d; background:rgba(194,144,77,.08); }
  .wpp-inst-row.disabled { cursor:default; opacity:.7; }
  .wpp-inst-info { display:flex; align-items:center; gap:10px; }
  .wpp-inst-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .wpp-inst-dot.on { background:#4caf50; box-shadow:0 0 6px rgba(76,175,80,.5); }
  .wpp-inst-dot.qr { background:#c2904d; box-shadow:0 0 6px rgba(194,144,77,.5); }
  .wpp-inst-dot.off { background:#4a3e30; }
  .wpp-inst-label { font-size:13px; font-weight:600; color:#fff9e6; }
  .wpp-inst-sub { font-size:11px; color:#5a4e3e; margin-top:1px; font-family:monospace; }
  .wpp-inst-radio { width:14px; height:14px; border-radius:50%; border:2px solid #4a3e30; margin-left:auto; flex-shrink:0; transition:all .15s; }
  .wpp-inst-radio.checked { border-color:#c2904d; background:#c2904d; }
  .wpp-inst-qr { margin-top:10px; padding-top:10px; border-top:1px solid #2a1f18; }
  .wpp-provider-btn:hover:not(.active) { border-color:rgba(194,144,77,.4); color:#a07840; }
  .wpp-disparo-footer { margin-top:12px; padding-top:16px; border-top:1px solid #2a1f18; display:flex; flex-direction:column; gap:10px; }
  .wpp-disparo-info { display:flex; align-items:center; gap:10px; }
  .wpp-disparo-tag { font-size:12px; color:#c2904d; background:rgba(194,144,77,.08); border:1px solid rgba(194,144,77,.15); padding:3px 10px; border-radius:20px; }
  .wpp-disparo-count { font-size:12px; color:#4a3e30; }

  /* Botões */
  .wpp-btn { padding:9px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; border:none; transition:all .15s; white-space:nowrap; }
  .wpp-btn:disabled { opacity:.4; cursor:default; }
  .wpp-btn-gold { background:linear-gradient(135deg,#c2904d,#d4a055); color:#0e0f09; }
  .wpp-btn-gold:hover:not(:disabled) { filter:brightness(1.08); }
  .wpp-btn-outline { background:rgba(255,255,255,.02); border:1px solid #2a1f18; color:#7a6e5e; }
  .wpp-btn-outline:hover:not(:disabled) { border-color:rgba(194,144,77,.3); color:#c2904d; }
  .wpp-btn-full { width:100%; }
  .wpp-btn-disparo { background:linear-gradient(135deg,#25a244,#1d8a38); color:#fff; font-size:14px; padding:13px 20px; border-radius:10px; width:100%; }
  .wpp-btn-disparo:hover:not(:disabled) { filter:brightness(1.08); }

  .wpp-icon-btn { background:transparent; border:1px solid #2a1f18; color:#4a3e30; width:26px; height:26px; border-radius:6px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; font-family:inherit; transition:all .15s; flex-shrink:0; }
  .wpp-icon-btn:hover { border-color:rgba(224,100,80,.3); color:#e07070; background:rgba(224,100,80,.06); }
  .wpp-icon-del:hover { border-color:rgba(224,100,80,.3); color:#e07070; }

  /* Import */
  .wpp-import-btns { margin-bottom:10px; }
  .wpp-import-msg { font-size:12px; padding:6px 0; }
  .wpp-import-msg.ok { color:#7ab87a; }
  .wpp-import-msg.erro { color:#e07070; }
  .wpp-import-hint { font-size:11px; color:#3a2e20; line-height:1.5; margin-top:8px; }

  .wpp-opcao-remover { margin-bottom:12px; }
  .wpp-check-label { display:flex; align-items:center; gap:8px; font-size:12px; color:#7a6e5e; cursor:pointer; }
  .wpp-check-label input { accent-color:#c2904d; }

  /* Resultado */
  .wpp-result { margin-top:14px; padding:12px 14px; border-radius:8px; font-size:13px; line-height:1.6; }
  .wpp-result.ok { background:rgba(100,180,100,.08); border:1px solid rgba(100,180,100,.2); color:#7ab87a; }
  .wpp-result.erro { background:rgba(224,112,112,.08); border:1px solid rgba(224,112,112,.2); color:#e07070; }

  /* Badge Leads AUTO */
  .wpp-badge-leads { font-size:9px; font-weight:700; letter-spacing:1px; background:rgba(194,144,77,.15); color:#c2904d; padding:1px 5px; border-radius:4px; margin-left:6px; vertical-align:middle; }

  /* Filtros */
  .wpp-filtros { margin-bottom:12px; }
  .wpp-filtros-row { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px; }
  .wpp-filtros-row .wpp-select { flex:1; min-width:120px; font-size:11px; }
  .wpp-btn-limpar { background:transparent; border:none; color:#c2904d; font-size:11px; cursor:pointer; font-family:inherit; text-decoration:underline; }

  /* Badge 24h */
  .wpp-badge-24h { font-size:9px; font-weight:700; padding:1px 5px; border-radius:4px; letter-spacing:0.5px; flex-shrink:0; }
  .wpp-badge-24h.dentro { background:rgba(100,180,100,.15); color:#7ab87a; }
  .wpp-badge-24h.fora { background:rgba(224,160,80,.12); color:#c2904d; }

  /* Tags de lead nos contatos */
  .wpp-contato-tag { font-size:9px; background:rgba(255,255,255,.04); border:1px solid #2a1f18; color:#5a4e3e; padding:1px 5px; border-radius:4px; }
  .wpp-contato-tag.st { text-transform:capitalize; }

  @media(max-width:1100px) {
    .wpp-content-grid { grid-template-columns:1fr; }
  }
  @media(max-width:768px) {
    .wpp-sidebar { width:200px; }
    .wpp-main { padding:20px; }
  }
`

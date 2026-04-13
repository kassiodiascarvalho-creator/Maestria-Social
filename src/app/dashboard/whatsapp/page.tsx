"use client"

import { useState, useEffect, useRef } from "react"

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Lista = { id: string; nome: string; criado_em: string; total_contatos: number }
type Contato = { id: string; nome: string | null; telefone: string }
type TipoMsg = "text" | "image" | "audio" | "video" | "document"

const TIPOS: { value: TipoMsg; label: string; icon: string; accept: string }[] = [
  { value: "text",     label: "Texto",     icon: "✉",  accept: "" },
  { value: "image",    label: "Foto",      icon: "🖼",  accept: "image/*" },
  { value: "audio",    label: "Áudio",     icon: "🎵",  accept: "audio/*" },
  { value: "video",    label: "Vídeo",     icon: "🎬",  accept: "video/*" },
  { value: "document", label: "Documento", icon: "📄",  accept: ".pdf,.doc,.docx,.xls,.xlsx" },
]

function normalizarDigito(tel: string, removerNono: boolean): string {
  let d = tel.replace(/\D/g, "")
  // garante DDI 55
  if (!d.startsWith("55")) d = "55" + d
  // remove 9º dígito (após DDI+DDD = 4 dígitos)
  if (removerNono && d.length === 13) {
    d = d.slice(0, 4) + d.slice(5)
  }
  return d
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

  // Disparo
  const [tipoMsg, setTipoMsg] = useState<TipoMsg>("text")
  const [texto, setTexto] = useState("")
  const [caption, setCaption] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [mediaFilename, setMediaFilename] = useState("")
  const [uploadando, setUploadando] = useState(false)
  const fileMediaRef = useRef<HTMLInputElement>(null)
  const [disparando, setDisparando] = useState(false)
  const [disparoResult, setDisparoResult] = useState<{ total: number; enviados: number; falhas: number } | null>(null)
  const [disparoErro, setDisparoErro] = useState("")

  // ── Carrega listas ──
  useEffect(() => { fetchListas() }, [])

  async function fetchListas() {
    const res = await fetch("/api/admin/wpp/listas")
    const data = await res.json()
    setListas(Array.isArray(data) ? data : [])
  }

  async function fetchContatos(listaId: string) {
    setCarregando(true)
    const res = await fetch(`/api/admin/wpp/listas/${listaId}/contatos`)
    const data = await res.json()
    setContatos(Array.isArray(data) ? data : [])
    setCarregando(false)
  }

  function selecionarLista(lista: Lista) {
    setListaAtiva(lista)
    setImportMsg("")
    setDisparoResult(null)
    setDisparoErro("")
    fetchContatos(lista.id)
  }

  // ── Criar lista ──
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

  // ── Remover lista ──
  async function removerLista(id: string) {
    if (!confirm("Remover esta lista e todos os contatos?")) return
    await fetch(`/api/admin/wpp/listas/${id}`, { method: "DELETE" })
    if (listaAtiva?.id === id) { setListaAtiva(null); setContatos([]) }
    fetchListas()
  }

  // ── Adicionar contato manual ──
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

  // ── Remover contato ──
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
        // Detecta separador
        const sep = lines[0]?.includes(";") ? ";" : ","
        // Detecta se tem header (primeira linha tem texto não numérico)
        const hasHeader = /[a-zA-Z]/.test(lines[0]?.split(sep)[0] ?? "")
        const dataLines = hasHeader ? lines.slice(1) : lines
        rows = dataLines
          .map(l => {
            const cols = l.split(sep).map(c => c.replace(/^"|"$/g, "").trim())
            // Tenta detectar qual coluna é telefone (tem dígitos)
            const telIdx = cols.findIndex(c => /\d{8,}/.test(c.replace(/\D/g, "")))
            if (telIdx === -1) return null
            const nomeIdx = telIdx === 0 ? 1 : 0
            return { nome: cols[nomeIdx] || undefined, telefone: cols[telIdx] }
          })
          .filter(Boolean) as Array<{ nome?: string; telefone: string }>
      } else {
        // Excel
        const buf = await file.arrayBuffer()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const XLSX = await import("xlsx") as any
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

      // Normaliza telefones
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

  // ── Upload de mídia ──
  async function uploadMidia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadando(true)
    setMediaUrl("")
    setMediaFilename("")
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/admin/wpp/upload", { method: "POST", body: form })
    const data = await res.json()
    setUploadando(false)
    if (res.ok) {
      setMediaUrl(data.url)
      setMediaFilename(data.filename)
    }
    if (fileMediaRef.current) fileMediaRef.current.value = ""
  }

  // ── Disparar mensagem ──
  async function disparar() {
    if (!listaAtiva) return
    if (tipoMsg === "text" && !texto.trim()) return
    if (tipoMsg !== "text" && !mediaUrl) return
    setDisparando(true)
    setDisparoResult(null)
    setDisparoErro("")

    const res = await fetch("/api/admin/wpp/disparar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lista_id: listaAtiva.id,
        tipo: tipoMsg,
        conteudo: tipoMsg === "text" ? texto : mediaUrl,
        caption: caption || undefined,
        filename: mediaFilename || undefined,
      }),
    })
    const data = await res.json()
    setDisparando(false)
    if (res.ok) {
      setDisparoResult({ total: data.total, enviados: data.enviados, falhas: data.falhas })
      setTexto("")
      setCaption("")
      setMediaUrl("")
      setMediaFilename("")
    } else {
      setDisparoErro(data.error || "Erro ao disparar")
    }
  }

  const tipoAtual = TIPOS.find(t => t.value === tipoMsg)!
  const podeDIsparar = listaAtiva && contatos.length > 0 &&
    (tipoMsg === "text" ? texto.trim().length > 0 : mediaUrl.length > 0)

  return (
    <>
      <style>{css}</style>
      <div className="wpp-layout">

        {/* ── Sidebar: listas ── */}
        <aside className="wpp-sidebar">
          <div className="wpp-sidebar-header">
            <h2 className="wpp-sidebar-title">Listas de Contatos</h2>
          </div>

          {/* Nova lista */}
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

          {/* Lista de listas */}
          <div className="wpp-listas-list">
            {listas.length === 0 && (
              <p className="wpp-empty">Nenhuma lista criada</p>
            )}
            {listas.map(l => (
              <div
                key={l.id}
                className={`wpp-lista-item${listaAtiva?.id === l.id ? " active" : ""}`}
                onClick={() => selecionarLista(l)}
              >
                <div className="wpp-lista-info">
                  <span className="wpp-lista-nome">{l.nome}</span>
                  <span className="wpp-lista-total">{l.total_contatos} contato{l.total_contatos !== 1 ? "s" : ""}</span>
                </div>
                <button
                  className="wpp-icon-btn wpp-icon-del"
                  onClick={e => { e.stopPropagation(); removerLista(l.id) }}
                  title="Remover lista"
                >✕</button>
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

                  {/* Importar */}
                  <div className="wpp-card">
                    <div className="wpp-card-title">Importar Contatos</div>

                    <div className="wpp-opcao-remover">
                      <label className="wpp-check-label">
                        <input type="checkbox" checked={removerNono} onChange={e => setRemoverNono(e.target.checked)} />
                        <span>Remover 9º dígito (números com 9 na frente)</span>
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
                        {importando ? "Importando..." : "↑ Importar CSV / Excel"}
                      </button>
                    </div>
                    {importMsg && (
                      <p className={`wpp-import-msg${importMsg.startsWith("✓") ? " ok" : " erro"}`}>{importMsg}</p>
                    )}
                    <p className="wpp-import-hint">
                      O arquivo deve ter colunas de nome e telefone. O sistema detecta automaticamente o formato (com ou sem cabeçalho).
                    </p>
                  </div>

                  {/* Adicionar manual */}
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

                  {/* Lista de contatos */}
                  <div className="wpp-card wpp-card-contatos">
                    <div className="wpp-card-title">Contatos da Lista</div>
                    {carregando && <p className="wpp-empty">Carregando...</p>}
                    {!carregando && contatos.length === 0 && (
                      <p className="wpp-empty">Nenhum contato ainda. Importe ou adicione manualmente.</p>
                    )}
                    {!carregando && contatos.length > 0 && (
                      <div className="wpp-contatos-list">
                        {contatos.map(c => (
                          <div key={c.id} className="wpp-contato-row">
                            <div className="wpp-contato-info">
                              {c.nome && <span className="wpp-contato-nome">{c.nome}</span>}
                              <span className="wpp-contato-tel">{c.telefone}</span>
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

                {/* ── Coluna direita: disparo ── */}
                <div className="wpp-col">
                  <div className="wpp-card">
                    <div className="wpp-card-title">Disparar Mensagem</div>

                    {/* Tipo de mensagem */}
                    <div className="wpp-tipos">
                      {TIPOS.map(t => (
                        <button
                          key={t.value}
                          className={`wpp-tipo-btn${tipoMsg === t.value ? " active" : ""}`}
                          onClick={() => { setTipoMsg(t.value); setMediaUrl(""); setMediaFilename(""); setCaption("") }}
                        >
                          <span>{t.icon}</span>
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Conteúdo */}
                    {tipoMsg === "text" ? (
                      <div className="wpp-field">
                        <label className="wpp-label">Mensagem</label>
                        <textarea
                          className="wpp-textarea"
                          rows={6}
                          placeholder="Digite sua mensagem..."
                          value={texto}
                          onChange={e => setTexto(e.target.value)}
                        />
                        <p className="wpp-char-count">{texto.length} caracteres</p>
                      </div>
                    ) : (
                      <div className="wpp-field">
                        <label className="wpp-label">{tipoAtual.label}</label>
                        <input
                          ref={fileMediaRef}
                          type="file"
                          accept={tipoAtual.accept}
                          style={{ display: "none" }}
                          onChange={uploadMidia}
                        />
                        {mediaUrl ? (
                          <div className="wpp-media-preview">
                            <span className="wpp-media-name">✓ {mediaFilename}</span>
                            <button
                              className="wpp-icon-btn wpp-icon-del"
                              onClick={() => { setMediaUrl(""); setMediaFilename("") }}
                            >✕</button>
                          </div>
                        ) : (
                          <button
                            className="wpp-btn wpp-btn-outline wpp-btn-full"
                            onClick={() => fileMediaRef.current?.click()}
                            disabled={uploadando}
                          >
                            {uploadando ? "Enviando arquivo..." : `↑ Selecionar ${tipoAtual.label}`}
                          </button>
                        )}

                        {(tipoMsg === "image" || tipoMsg === "video" || tipoMsg === "document") && (
                          <div className="wpp-field" style={{ marginTop: 12 }}>
                            <label className="wpp-label">Legenda / Caption (opcional)</label>
                            <input
                              className="wpp-input"
                              placeholder="Legenda da mídia..."
                              value={caption}
                              onChange={e => setCaption(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resumo e botão de disparo */}
                    <div className="wpp-disparo-footer">
                      <div className="wpp-disparo-info">
                        <span className="wpp-disparo-tag">◈ {listaAtiva.nome}</span>
                        <span className="wpp-disparo-count">{contatos.length} destinatário{contatos.length !== 1 ? "s" : ""}</span>
                      </div>
                      <button
                        className="wpp-btn wpp-btn-disparo"
                        onClick={disparar}
                        disabled={!podeDIsparar || disparando}
                      >
                        {disparando
                          ? `Enviando... (pode demorar)`
                          : `↗ Disparar para ${contatos.length} contato${contatos.length !== 1 ? "s" : ""}`}
                      </button>
                    </div>

                    {disparoResult && (
                      <div className="wpp-result ok">
                        <strong>Disparo concluído!</strong><br />
                        ✓ {disparoResult.enviados} enviados · {disparoResult.falhas} falhas · {disparoResult.total} total
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
  .wpp-char-count { font-size:11px; color:#3a2e20; text-align:right; }

  /* Tipo mensagem */
  .wpp-tipos { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
  .wpp-tipo-btn { display:flex; flex-direction:column; align-items:center; gap:3px; padding:8px 10px; min-width:64px; background:rgba(255,255,255,.02); border:1px solid #2a1f18; border-radius:10px; color:#7a6e5e; font-size:11px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .15s; }
  .wpp-tipo-btn:hover { border-color:rgba(194,144,77,.25); color:#c2904d; }
  .wpp-tipo-btn.active { background:rgba(194,144,77,.1); border-color:rgba(194,144,77,.3); color:#c2904d; }
  .wpp-tipo-btn span:first-child { font-size:18px; }

  /* Upload mídia */
  .wpp-media-preview { display:flex; align-items:center; gap:8px; padding:10px 12px; background:rgba(194,144,77,.06); border:1px solid rgba(194,144,77,.2); border-radius:8px; }
  .wpp-media-name { flex:1; font-size:13px; color:#c2904d; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  /* Disparo footer */
  .wpp-disparo-footer { margin-top:20px; padding-top:16px; border-top:1px solid #2a1f18; display:flex; flex-direction:column; gap:10px; }
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

  @media(max-width:1100px) {
    .wpp-content-grid { grid-template-columns:1fr; }
  }
  @media(max-width:768px) {
    .wpp-sidebar { width:200px; }
    .wpp-main { padding:20px; }
  }
`

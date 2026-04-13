"use client"

import { useState, useEffect } from "react"

type Dominio = {
  id: string
  label: string
  url: string
  descricao: string
}

const DOMINIOS_PADRAO: Dominio[] = [
  { id: "home", label: "Site principal", url: "https://www.maestriasocial.com", descricao: "Página de captura de leads" },
  { id: "quiz", label: "Diagnóstico", url: "https://www.maestriasocial.com/quiz", descricao: "Teste de Quociente Social" },
  { id: "dashboard", label: "Dashboard", url: "https://www.maestriasocial.com/dashboard", descricao: "Painel administrativo" },
  { id: "resultado", label: "Resultado", url: "https://www.maestriasocial.com/resultado", descricao: "Página de resultado do diagnóstico" },
  { id: "intro", label: "Intro", url: "https://www.maestriasocial.com/intro", descricao: "Página de introdução antes do quiz" },
]

const LS_KEY = "ms_dominios"

function loadDominios(): Dominio[] {
  if (typeof window === "undefined") return DOMINIOS_PADRAO
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DOMINIOS_PADRAO
    return JSON.parse(raw) as Dominio[]
  } catch {
    return DOMINIOS_PADRAO
  }
}

function saveDominios(dominios: Dominio[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(dominios))
}

const VAZIO: Omit<Dominio, "id"> = { label: "", url: "", descricao: "" }

export default function DominiosPage() {
  const [dominios, setDominios] = useState<Dominio[]>([])
  const [form, setForm] = useState<Omit<Dominio, "id">>(VAZIO)
  const [editId, setEditId] = useState<string | null>(null)
  const [erroUrl, setErroUrl] = useState("")

  useEffect(() => {
    setDominios(loadDominios())
  }, [])

  function validarUrl(url: string): boolean {
    try { new URL(url); return true } catch { return false }
  }

  function salvar() {
    if (!form.label.trim()) return
    if (!validarUrl(form.url)) { setErroUrl("URL inválida. Use o formato https://..."); return }
    setErroUrl("")

    let next: Dominio[]
    if (editId) {
      next = dominios.map(d => d.id === editId ? { ...d, ...form } : d)
    } else {
      next = [...dominios, { id: crypto.randomUUID(), ...form }]
    }
    setDominios(next)
    saveDominios(next)
    setForm(VAZIO)
    setEditId(null)
  }

  function iniciarEdicao(d: Dominio) {
    setEditId(d.id)
    setForm({ label: d.label, url: d.url, descricao: d.descricao })
    setErroUrl("")
  }

  function cancelarEdicao() {
    setEditId(null)
    setForm(VAZIO)
    setErroUrl("")
  }

  function remover(id: string) {
    const next = dominios.filter(d => d.id !== id)
    setDominios(next)
    saveDominios(next)
    if (editId === id) cancelarEdicao()
  }

  return (
    <>
      <style>{css}</style>
      <div className="dom-wrap">
        <div className="dom-header">
          <h1 className="dom-title">Domínios & Links</h1>
          <p className="dom-sub">Cadastre e acesse rapidamente todos os links do projeto</p>
        </div>

        {/* Lista de domínios */}
        <div className="dom-grid">
          {dominios.map(d => (
            <div key={d.id} className="dom-card">
              <div className="dom-card-top">
                <div>
                  <div className="dom-card-label">{d.label}</div>
                  {d.descricao && <div className="dom-card-desc">{d.descricao}</div>}
                </div>
                <div className="dom-card-actions">
                  <button className="dom-icon-btn" title="Editar" onClick={() => iniciarEdicao(d)}>✎</button>
                  <button className="dom-icon-btn dom-icon-del" title="Remover" onClick={() => remover(d.id)}>✕</button>
                </div>
              </div>
              <a
                className="dom-card-url"
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="dom-url-text">{d.url}</span>
                <span className="dom-url-arrow">↗</span>
              </a>
            </div>
          ))}
        </div>

        {/* Formulário de adicionar / editar */}
        <div className="dom-form-wrap">
          <div className="dom-form-title">
            {editId ? "✎ Editar domínio" : "+ Adicionar domínio"}
          </div>
          <div className="dom-form-row">
            <div className="dom-field">
              <label className="dom-label">Nome / Label</label>
              <input
                className="dom-input"
                placeholder="Ex: Site principal"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="dom-field" style={{ flex: 2 }}>
              <label className="dom-label">URL completa</label>
              <input
                className={`dom-input${erroUrl ? " dom-input-error" : ""}`}
                placeholder="https://www.maestriasocial.com/..."
                value={form.url}
                onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setErroUrl("") }}
              />
              {erroUrl && <span className="dom-error">{erroUrl}</span>}
            </div>
            <div className="dom-field" style={{ flex: 2 }}>
              <label className="dom-label">Descrição (opcional)</label>
              <input
                className="dom-input"
                placeholder="Ex: Página de captura de leads"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>
          </div>
          <div className="dom-form-btns">
            <button
              className="dom-btn dom-btn-primary"
              onClick={salvar}
              disabled={!form.label.trim() || !form.url.trim()}
            >
              {editId ? "Salvar alterações" : "Adicionar"}
            </button>
            {editId && (
              <button className="dom-btn dom-btn-ghost" onClick={cancelarEdicao}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const css = `
  .dom-wrap{padding:40px;max-width:900px;}
  .dom-header{margin-bottom:32px;}
  .dom-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;color:#fff9e6;margin-bottom:6px;}
  .dom-sub{font-size:13px;color:#7a6e5e;}

  .dom-grid{display:flex;flex-direction:column;gap:10px;margin-bottom:36px;}

  .dom-card{background:#1a1410;border:1px solid #2a1f18;border-radius:12px;padding:18px 20px;transition:border-color .15s;}
  .dom-card:hover{border-color:rgba(194,144,77,.2);}
  .dom-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;}
  .dom-card-label{font-size:15px;font-weight:600;color:#fff9e6;margin-bottom:3px;}
  .dom-card-desc{font-size:12px;color:#4a3e30;}
  .dom-card-actions{display:flex;gap:6px;flex-shrink:0;}
  .dom-icon-btn{background:transparent;border:1px solid #2a1f18;color:#4a3e30;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s;font-family:inherit;}
  .dom-icon-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;background:rgba(194,144,77,.06);}
  .dom-icon-del:hover{border-color:rgba(224,100,80,.3);color:#e07070;background:rgba(224,100,80,.06);}
  .dom-card-url{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.2);border:1px solid #2a1f18;border-radius:8px;padding:10px 14px;text-decoration:none;transition:border-color .15s,background .15s;}
  .dom-card-url:hover{border-color:rgba(194,144,77,.3);background:rgba(194,144,77,.04);}
  .dom-url-text{font-size:13px;color:#c2904d;font-family:monospace;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .dom-url-arrow{font-size:14px;color:#c2904d;flex-shrink:0;}

  .dom-form-wrap{background:#1a1410;border:1px solid #2a1f18;border-radius:14px;padding:24px;}
  .dom-form-title{font-size:13px;font-weight:700;letter-spacing:1px;color:#c2904d;margin-bottom:16px;text-transform:uppercase;}
  .dom-form-row{display:flex;gap:12px;flex-wrap:wrap;}
  .dom-field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:160px;}
  .dom-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;}
  .dom-input{background:#0e0f09;border:1px solid #2a1f18;border-radius:8px;padding:9px 12px;color:#fff9e6;font-size:13px;font-family:inherit;outline:none;transition:border-color .15s;width:100%;}
  .dom-input:focus{border-color:rgba(194,144,77,.35);}
  .dom-input-error{border-color:rgba(224,100,80,.4) !important;}
  .dom-error{font-size:11px;color:#e07070;}
  .dom-form-btns{display:flex;gap:10px;margin-top:16px;}
  .dom-btn{padding:10px 22px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;border:none;transition:filter .15s,opacity .15s;}
  .dom-btn:disabled{opacity:.35;cursor:default;}
  .dom-btn-primary{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;}
  .dom-btn-primary:hover:not(:disabled){filter:brightness(1.08);}
  .dom-btn-ghost{background:transparent;border:1px solid #2a1f18;color:#7a6e5e;}
  .dom-btn-ghost:hover{color:#fff9e6;border-color:#4a3e30;}
  @media(max-width:768px){.dom-wrap{padding:20px;} .dom-form-row{flex-direction:column;}}
`

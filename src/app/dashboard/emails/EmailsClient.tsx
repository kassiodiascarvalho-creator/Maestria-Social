"use client"

import { useState } from "react"

const PILARES = ["Sociabilidade", "Comunicação", "Relacionamento", "Persuasão", "Influência"] as const
const DIAS = [0, 1, 3, 5, 7] as const
const LABEL_DIA: Record<number, string> = { 0: "D+0 (imediato)", 1: "D+1", 3: "D+3", 5: "D+5", 7: "D+7" }

type Template = {
  id: string
  pilar: string
  dia: number
  assunto: string
  corpo_html: string
  ativo: boolean
  atualizado_em: string
}

export default function EmailsClient({ templates: inicial }: { templates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(inicial)
  const [pilarAtivo, setPilarAtivo] = useState<string>(PILARES[0])
  const [diaAtivo, setDiaAtivo] = useState<number>(0)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)

  const tpl = templates.find(t => t.pilar === pilarAtivo && t.dia === diaAtivo)

  const [rascunho, setRascunho] = useState({ assunto: "", corpo_html: "" })

  function iniciarEdicao() {
    if (!tpl) return
    setRascunho({ assunto: tpl.assunto, corpo_html: tpl.corpo_html })
    setEditando(true)
    setMsg(null)
  }

  function cancelarEdicao() {
    setEditando(false)
    setMsg(null)
  }

  async function salvar() {
    if (!tpl) return
    setSalvando(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/emails/templates/${tpl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rascunho),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, ...rascunho, atualizado_em: data.atualizado_em } : t))
      setEditando(false)
      setMsg({ tipo: "ok", texto: "Template salvo com sucesso." })
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." })
    } finally {
      setSalvando(false)
    }
  }

  async function enviarManual(leadId?: string) {
    if (!tpl) return
    setEnviando(true)
    setMsg(null)
    try {
      const res = await fetch("/api/admin/emails/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: tpl.id, lead_id: leadId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ tipo: "ok", texto: `Enviado: ${data.enviados} ok, ${data.falhas} falhas (total ${data.total}).` })
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao enviar." })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="em-wrap">
        <div className="em-header">
          <h1 className="em-title">Emails do Funil</h1>
          <p className="em-sub">25 templates segmentados por pilar · edite e envie manualmente quando quiser</p>
        </div>

        {/* Seletor de pilar */}
        <div className="em-pilares">
          {PILARES.map(p => (
            <button
              key={p}
              className={`em-pilar-btn${pilarAtivo === p ? " active" : ""}`}
              onClick={() => { setPilarAtivo(p); setEditando(false); setMsg(null) }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Seletor de dia */}
        <div className="em-dias">
          {DIAS.map(d => (
            <button
              key={d}
              className={`em-dia-btn${diaAtivo === d ? " active" : ""}`}
              onClick={() => { setDiaAtivo(d); setEditando(false); setMsg(null) }}
            >
              {LABEL_DIA[d]}
            </button>
          ))}
        </div>

        {tpl && (
          <div className="em-card">
            <div className="em-card-meta">
              <span className="em-badge">{tpl.pilar}</span>
              <span className="em-badge em-badge-dia">{LABEL_DIA[tpl.dia]}</span>
              <span className="em-updated">Atualizado: {new Date(tpl.atualizado_em).toLocaleString("pt-BR")}</span>
            </div>

            {editando ? (
              <div className="em-edit-form">
                <label className="em-label">Assunto</label>
                <input
                  className="em-input"
                  value={rascunho.assunto}
                  onChange={e => setRascunho(r => ({ ...r, assunto: e.target.value }))}
                />
                <label className="em-label" style={{ marginTop: 16 }}>
                  Corpo (HTML — use &#123;nome&#125;, &#123;qs_total&#125;, &#123;pilar_fraco&#125;, &#123;link_resultado&#125;)
                </label>
                <textarea
                  className="em-textarea"
                  value={rascunho.corpo_html}
                  onChange={e => setRascunho(r => ({ ...r, corpo_html: e.target.value }))}
                  rows={14}
                />
                <div className="em-actions">
                  <button className="em-btn em-btn-primary" onClick={salvar} disabled={salvando}>
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                  <button className="em-btn em-btn-ghost" onClick={cancelarEdicao}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="em-preview">
                <div className="em-assunto-label">Assunto</div>
                <div className="em-assunto">{tpl.assunto}</div>
                <div className="em-assunto-label" style={{ marginTop: 16 }}>Prévia do corpo</div>
                <div className="em-corpo" dangerouslySetInnerHTML={{ __html: tpl.corpo_html }} />
                <div className="em-actions">
                  <button className="em-btn em-btn-primary" onClick={iniciarEdicao}>✎ Editar</button>
                  <button className="em-btn em-btn-send" onClick={() => enviarManual()} disabled={enviando}>
                    {enviando ? "Enviando..." : "↗ Enviar para todos os leads"}
                  </button>
                </div>
              </div>
            )}

            {msg && (
              <div className={`em-msg ${msg.tipo}`}>{msg.texto}</div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

const css = `
  .em-wrap{padding:40px;max-width:860px;}
  .em-header{margin-bottom:28px;}
  .em-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;color:#fff9e6;margin-bottom:6px;}
  .em-sub{font-size:13px;color:#7a6e5e;}
  .em-pilares{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
  .em-pilar-btn{background:rgba(255,255,255,.03);border:1px solid #2a1f18;color:#7a6e5e;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;}
  .em-pilar-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .em-pilar-btn.active{background:rgba(194,144,77,.1);border-color:rgba(194,144,77,.3);color:#c2904d;}
  .em-dias{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px;}
  .em-dia-btn{background:rgba(255,255,255,.02);border:1px solid #2a1f18;color:#7a6e5e;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit;transition:all .15s;}
  .em-dia-btn:hover{border-color:rgba(194,144,77,.2);color:#c2904d;}
  .em-dia-btn.active{background:rgba(194,144,77,.08);border-color:rgba(194,144,77,.25);color:#c2904d;}
  .em-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:28px;}
  .em-card-meta{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap;}
  .em-badge{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2904d;background:rgba(194,144,77,.08);border:1px solid rgba(194,144,77,.2);padding:4px 10px;border-radius:6px;}
  .em-badge-dia{color:#7a9ec0;background:rgba(122,158,192,.08);border-color:rgba(122,158,192,.2);}
  .em-updated{font-size:11px;color:#4a3e30;margin-left:auto;}
  .em-assunto-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;margin-bottom:6px;}
  .em-assunto{font-size:16px;font-weight:600;color:#fff9e6;margin-bottom:4px;}
  .em-corpo{font-size:14px;line-height:1.7;color:#cdbfa8;margin-top:8px;padding:16px;background:rgba(0,0,0,.2);border-radius:10px;border:1px solid #2a1f18;}
  .em-corpo p{margin:0 0 10px;}
  .em-corpo ol{margin:0 0 10px;padding-left:20px;}
  .em-corpo li{margin-bottom:6px;}
  .em-corpo a{color:#c2904d;}
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
  .em-input{width:100%;background:#13100c;border:1px solid #2a1f18;border-radius:8px;padding:10px 12px;color:#fff9e6;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s;}
  .em-input:focus{border-color:rgba(194,144,77,.35);}
  .em-textarea{width:100%;background:#13100c;border:1px solid #2a1f18;border-radius:8px;padding:12px;color:#cdbfa8;font-size:13px;font-family:monospace;outline:none;resize:vertical;transition:border-color .15s;line-height:1.6;}
  .em-textarea:focus{border-color:rgba(194,144,77,.35);}
  .em-edit-form{display:flex;flex-direction:column;}
  .em-msg{margin-top:16px;padding:10px 14px;border-radius:8px;font-size:13px;}
  .em-msg.ok{background:rgba(100,180,100,.08);border:1px solid rgba(100,180,100,.2);color:#7ab87a;}
  .em-msg.erro{background:rgba(224,112,112,.08);border:1px solid rgba(224,112,112,.2);color:#e07070;}
  @media(max-width:768px){.em-wrap{padding:20px;}}
`

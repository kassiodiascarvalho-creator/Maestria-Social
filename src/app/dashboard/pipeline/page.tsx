"use client";

import { useState, useEffect, useRef } from "react";

type Etapa = {
  id: string; slug: string; label: string;
  emoji: string | null; icone_url: string | null;
  cor: string; ordem: number; is_final: boolean;
};

const EMOJIS = [
  "🌱","💬","⚡","🎯","📅","✅","❌","🔥","💡","🚀","⭐","🏆","👋","💼","📊",
  "🔔","📌","🗂️","🤝","💰","🎁","📣","🔑","💎","🏅","🕐","📋","✍️","🧲","🌟",
];

const CORES_SUGERIDAS = [
  "#7ab0e0","#6acca0","#c2904d","#a07ae0","#7ae0d4",
  "#f0c040","#e07070","#e090c0","#90e0b0","#b0c0ff",
];

const EMPTY: Omit<Etapa, "id" | "ordem"> = {
  slug: "", label: "", emoji: "🌱", icone_url: null, cor: "#7ab0e0", is_final: false,
};

export default function PipelinePage() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Etapa> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState<{ id: string; over: string | null }>({ id: "", over: null });
  const fileRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    setLoading(true);
    const d = await fetch("/api/admin/pipeline/etapas").then(r => r.json()).catch(() => []);
    setEtapas(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvar() {
    if (!modal) return;
    setSaving(true);
    const isNew = !modal.id;

    // Auto-gera slug se novo
    const body = { ...modal };
    if (isNew && !body.slug && body.label) {
      body.slug = body.label
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
    }

    const url = isNew ? "/api/admin/pipeline/etapas" : `/api/admin/pipeline/etapas/${modal.id}`;
    const method = isNew ? "POST" : "PATCH";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setModal(null);
    carregar();
  }

  async function excluir(id: string) {
    setErroExclusao(null);
    setDeleting(id);
    const res = await fetch(`/api/admin/pipeline/etapas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErroExclusao(d.error ?? "Erro ao excluir.");
    } else {
      carregar();
    }
    setDeleting(null);
  }

  async function uploadIcone(file: File) {
    if (!modal?.id) return;
    setUploading(true);
    const form = new FormData();
    form.append("id", modal.id);
    form.append("file", file);
    const res = await fetch("/api/admin/pipeline/etapas/icone", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      setModal(m => m ? { ...m, icone_url: data.icone_url } : m);
      carregar();
    }
    setUploading(false);
  }

  // ── Drag & Drop para reordenar ──────────────────────────────────────────────
  function onDragStart(id: string) { setDrag({ id, over: null }); }
  function onDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDrag(d => ({ ...d, over: id })); }
  function onDragEnd() {
    if (!drag.id || !drag.over || drag.id === drag.over) { setDrag({ id: "", over: null }); return; }
    const from = etapas.findIndex(e => e.id === drag.id);
    const to   = etapas.findIndex(e => e.id === drag.over);
    if (from === -1 || to === -1) { setDrag({ id: "", over: null }); return; }
    const nova = [...etapas];
    const [item] = nova.splice(from, 1);
    nova.splice(to, 0, item);
    setEtapas(nova);
    setDrag({ id: "", over: null });
    // Persiste nova ordem
    fetch("/api/admin/pipeline/etapas/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: nova.map(e => e.id) }),
    });
  }

  return (
    <div style={{ padding: "32px 28px", maxWidth: 860, margin: "0 auto" }}>
      <style>{css}</style>

      {/* Erro exclusão */}
      {erroExclusao && (
        <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#ef4444", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{erroExclusao}</span>
          <button onClick={() => setErroExclusao(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff9e6", marginBottom: 4 }}>Pipeline de Etapas</h1>
          <p style={{ fontSize: 13, color: "#7a6e5e" }}>Configure as colunas do Kanban. Arraste para reordenar.</p>
        </div>
        <button className="pl-btn-add" onClick={() => setModal({ ...EMPTY })}>+ Nova etapa</button>
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: "#4a3e30", fontSize: 13 }}>Carregando...</p>
      ) : (
        <div>
          {etapas.map(etapa => (
            <div
              key={etapa.id}
              draggable
              onDragStart={() => onDragStart(etapa.id)}
              onDragOver={e => onDragOver(e, etapa.id)}
              onDragEnd={onDragEnd}
              className={`pl-row${drag.over === etapa.id && drag.id !== etapa.id ? " pl-row-over" : ""}`}
            >
              {/* Drag handle */}
              <span className="pl-drag">⠿</span>

              {/* Ícone / Emoji */}
              <span className="pl-icone" style={{ background: etapa.cor + "22", border: `1px solid ${etapa.cor}55` }}>
                {etapa.icone_url
                  ? <img src={etapa.icone_url} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
                  : <span style={{ fontSize: 18 }}>{etapa.emoji ?? "◆"}</span>}
              </span>

              {/* Infos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#fff9e6" }}>{etapa.label}</span>
                  {etapa.is_final && <span className="pl-badge-final">Final</span>}
                </div>
                <span style={{ fontSize: 12, color: "#4a3e30", fontFamily: "monospace" }}>slug: {etapa.slug}</span>
              </div>

              {/* Cor */}
              <span className="pl-cor-dot" style={{ background: etapa.cor }} title={etapa.cor} />

              {/* Ações */}
              <button className="pl-icon-btn" onClick={() => setModal({ ...etapa })} title="Editar">✎</button>
              <button className="pl-icon-btn pl-icon-del" onClick={() => excluir(etapa.id)} disabled={deleting === etapa.id} title="Excluir">
                {deleting === etapa.id ? "…" : "✕"}
              </button>
            </div>
          ))}

          {etapas.length === 0 && (
            <p style={{ color: "#4a3e30", fontSize: 13 }}>Nenhuma etapa configurada. Clique em &quot;+ Nova etapa&quot; para começar.</p>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="pl-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="pl-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff9e6" }}>
                {modal.id ? "Editar etapa" : "Nova etapa"}
              </h2>
              <button className="pl-close" onClick={() => setModal(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Label */}
              <div>
                <label className="pl-label">Nome da etapa</label>
                <input className="pl-input" value={modal.label ?? ""} onChange={e => setModal(m => ({ ...m!, label: e.target.value }))} placeholder="Ex: Negociação" />
              </div>

              {/* Slug (apenas para edição — gerado auto no POST) */}
              {modal.id && (
                <div>
                  <label className="pl-label">Slug (identificador único)</label>
                  <input className="pl-input" value={modal.slug ?? ""} onChange={e => setModal(m => ({ ...m!, slug: e.target.value }))} placeholder="ex: negociacao" style={{ fontFamily: "monospace" }} />
                  <p style={{ fontSize: 11, color: "#4a3e30", marginTop: 4 }}>⚠ Alterar o slug pode afetar leads já nessa etapa.</p>
                </div>
              )}

              {/* Ícone: emoji ou upload */}
              <div>
                <label className="pl-label">Ícone</label>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

                  {/* Preview atual */}
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: (modal.cor ?? "#7ab0e0") + "22", border: `1px solid ${modal.cor ?? "#7ab0e0"}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {modal.icone_url
                      ? <img src={modal.icone_url} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
                      : <span style={{ fontSize: 24 }}>{modal.emoji ?? "◆"}</span>}
                  </div>

                  <div style={{ flex: 1 }}>
                    {/* Grade de emojis */}
                    <div className="pl-emoji-grid">
                      {EMOJIS.map(em => (
                        <button key={em} className={`pl-emoji-btn${modal.emoji === em && !modal.icone_url ? " pl-emoji-ativo" : ""}`}
                          onClick={() => setModal(m => ({ ...m!, emoji: em, icone_url: null }))}
                        >{em}</button>
                      ))}
                    </div>

                    {/* Upload SVG/PNG */}
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      <button className="pl-btn-upload" onClick={() => fileRef.current?.click()} disabled={uploading || !modal.id}>
                        {uploading ? "Enviando..." : "📁 Upload de ícone (SVG/PNG)"}
                      </button>
                      {!modal.id && <span style={{ fontSize: 11, color: "#4a3e30" }}>Salve primeiro para fazer upload</span>}
                      {modal.icone_url && (
                        <button className="pl-btn-clear" onClick={() => setModal(m => ({ ...m!, icone_url: null }))}>Remover ícone</button>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.webp" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadIcone(f); }} />
                  </div>
                </div>
              </div>

              {/* Cor */}
              <div>
                <label className="pl-label">Cor</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  {CORES_SUGERIDAS.map(c => (
                    <button key={c} onClick={() => setModal(m => ({ ...m!, cor: c }))}
                      style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: modal.cor === c ? "3px solid #fff9e6" : "3px solid transparent", cursor: "pointer" }} />
                  ))}
                  <input type="color" value={modal.cor ?? "#7ab0e0"} onChange={e => setModal(m => ({ ...m!, cor: e.target.value }))}
                    style={{ width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", padding: 2, background: "none" }} title="Cor personalizada" />
                </div>
              </div>

              {/* is_final */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="final-chk" checked={modal.is_final ?? false}
                  onChange={e => setModal(m => ({ ...m!, is_final: e.target.checked }))}
                  style={{ accentColor: "#c2904d", width: 16, height: 16 }} />
                <label htmlFor="final-chk" style={{ fontSize: 13, color: "#c8b99a", cursor: "pointer" }}>
                  Etapa final (ex: Convertido, Perdido) — pode ser definida a qualquer momento pelo agente
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="pl-btn-cancel" onClick={() => setModal(null)}>Cancelar</button>
              <button className="pl-btn-save" onClick={salvar} disabled={saving || !modal.label}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const css = `
  .pl-btn-add{background:rgba(194,144,77,.12);border:1px solid rgba(194,144,77,.25);color:#c2904d;padding:9px 18px;border-radius:9px;font-size:13px;cursor:pointer;transition:background .15s;white-space:nowrap;font-family:inherit;}
  .pl-btn-add:hover{background:rgba(194,144,77,.2);}
  .pl-row{display:flex;align-items:center;gap:12px;background:#111009;border:1px solid #2a1f18;border-radius:12px;padding:14px 16px;margin-bottom:8px;cursor:grab;transition:border-color .15s,transform .1s;}
  .pl-row:hover{border-color:#3a2f20;}
  .pl-row-over{border-color:#c2904d;transform:scale(1.01);}
  .pl-drag{color:#2a1f18;font-size:18px;cursor:grab;user-select:none;line-height:1;}
  .pl-drag:hover{color:#4a3e30;}
  .pl-icone{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .pl-badge-final{display:inline-block;font-size:10px;padding:2px 7px;border-radius:99px;background:rgba(194,144,77,.15);color:#c2904d;font-weight:600;}
  .pl-cor-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;}
  .pl-icon-btn{background:none;border:1px solid #2a1f18;color:#4a3e30;width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;flex-shrink:0;}
  .pl-icon-btn:hover{background:rgba(255,255,255,.05);color:#c8b99a;}
  .pl-icon-btn:disabled{opacity:.4;cursor:default;}
  .pl-icon-del:hover{background:rgba(239,68,68,.1);color:#ef4444;border-color:rgba(239,68,68,.2);}
  .pl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
  .pl-modal{background:#111009;border:1px solid #2a1f18;border-radius:16px;padding:28px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;}
  .pl-close{background:none;border:none;color:#4a3e30;font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px;}
  .pl-close:hover{color:#c8b99a;}
  .pl-label{display:block;font-size:12px;color:#7a6e5e;margin-bottom:5px;font-weight:500;}
  .pl-input{width:100%;background:#0e0f09;border:1px solid #2a1f18;color:#fff9e6;padding:10px 12px;border-radius:8px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;}
  .pl-input:focus{border-color:#c2904d;}
  .pl-emoji-grid{display:flex;flex-wrap:wrap;gap:6px;}
  .pl-emoji-btn{background:rgba(255,255,255,.03);border:1px solid #2a1f18;border-radius:7px;width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .12s,border-color .12s;line-height:1;}
  .pl-emoji-btn:hover{background:rgba(194,144,77,.1);border-color:rgba(194,144,77,.3);}
  .pl-emoji-ativo{background:rgba(194,144,77,.15);border-color:#c2904d;}
  .pl-btn-upload{background:rgba(255,255,255,.04);border:1px solid #2a1f18;color:#7a6e5e;padding:7px 14px;border-radius:8px;font-size:12px;cursor:pointer;transition:background .15s;font-family:inherit;}
  .pl-btn-upload:hover:not(:disabled){background:rgba(255,255,255,.08);color:#c8b99a;}
  .pl-btn-upload:disabled{opacity:.4;cursor:default;}
  .pl-btn-clear{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ef4444;padding:7px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;}
  .pl-btn-clear:hover{background:rgba(239,68,68,.15);}
  .pl-btn-cancel{background:none;border:1px solid #2a1f18;color:#7a6e5e;padding:9px 18px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;}
  .pl-btn-cancel:hover{color:#c8b99a;border-color:#3a2f20;}
  .pl-btn-save{background:#c2904d;border:none;color:#0e0f09;padding:9px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;font-family:inherit;}
  .pl-btn-save:hover:not(:disabled){background:#d4a060;}
  .pl-btn-save:disabled{opacity:.5;cursor:default;}
`;

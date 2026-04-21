"use client";

import { useState, useEffect, useCallback } from "react";

type Agente = { id: string; nome: string };
type FollowupConfig = {
  id: string;
  agente_id: string | null;
  nome: string;
  tipo: "lembrete_reuniao" | "reengajamento";
  ativo: boolean;
  horas_antes: number | null;
  horas_sem_resposta: number | null;
  mensagem: string;
  ordem: number;
};

const VARIAVEIS = ["{nome}", "{data_reuniao}", "{horario_reuniao}", "{link_reuniao}", "{pilar_fraco}"];

const EMPTY_LEMBRETE: Omit<FollowupConfig, "id"> = {
  agente_id: null, nome: "", tipo: "lembrete_reuniao", ativo: true,
  horas_antes: 24, horas_sem_resposta: null, mensagem: "", ordem: 0,
};
const EMPTY_REENG: Omit<FollowupConfig, "id"> = {
  agente_id: null, nome: "", tipo: "reengajamento", ativo: true,
  horas_antes: null, horas_sem_resposta: 2, mensagem: "", ordem: 0,
};

export default function FollowupPage() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [agenteId, setAgenteId] = useState<string>("");
  const [configs, setConfigs] = useState<FollowupConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [modal, setModal] = useState<Partial<FollowupConfig> | null>(null);
  const [tab, setTab] = useState<"lembrete_reuniao" | "reengajamento">("lembrete_reuniao");

  useEffect(() => {
    fetch("/api/admin/agentes").then(r => r.json()).then((data: Agente[]) => {
      setAgentes(data ?? []);
      if (data?.length) setAgenteId(data[0].id);
    });
  }, []);

  const carregar = useCallback(() => {
    if (!agenteId) return;
    setLoading(true);
    fetch(`/api/admin/followup/configs?agente_id=${agenteId}`)
      .then(r => r.json())
      .then((d: FollowupConfig[]) => setConfigs(d ?? []))
      .finally(() => setLoading(false));
  }, [agenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    if (!modal) return;
    setSaving("save");
    const body = { ...modal, agente_id: agenteId };
    const isNew = !modal.id;
    const url = isNew ? "/api/admin/followup/configs" : `/api/admin/followup/configs/${modal.id}`;
    const method = isNew ? "POST" : "PATCH";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(null);
    setModal(null);
    carregar();
  }

  async function toggleAtivo(cfg: FollowupConfig) {
    setSaving(cfg.id);
    await fetch(`/api/admin/followup/configs/${cfg.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !cfg.ativo }),
    });
    setSaving(null);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este follow-up?")) return;
    setSaving(id);
    await fetch(`/api/admin/followup/configs/${id}`, { method: "DELETE" });
    setSaving(null);
    carregar();
  }

  function novoModal(tipo: "lembrete_reuniao" | "reengajamento") {
    setModal(tipo === "lembrete_reuniao" ? { ...EMPTY_LEMBRETE } : { ...EMPTY_REENG });
  }

  function inserirVariavel(v: string) {
    setModal(m => m ? { ...m, mensagem: (m.mensagem ?? "") + v } : m);
  }

  const lembretes = configs.filter(c => c.tipo === "lembrete_reuniao").sort((a, b) => (a.horas_antes ?? 0) - (b.horas_antes ?? 0));
  const reengajamentos = configs.filter(c => c.tipo === "reengajamento").sort((a, b) => (a.horas_sem_resposta ?? 0) - (b.horas_sem_resposta ?? 0));

  return (
    <div style={{ padding: "32px 28px", maxWidth: 900, margin: "0 auto" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff9e6", marginBottom: 4 }}>Follow-up Automático</h1>
        <p style={{ fontSize: 13, color: "#7a6e5e" }}>Lembretes de reunião e reengajamento por inatividade</p>
      </div>

      {/* Seletor de agente */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28 }}>
        <label style={{ fontSize: 13, color: "#7a6e5e", whiteSpace: "nowrap" }}>Agente:</label>
        <select className="fu-select" value={agenteId} onChange={e => setAgenteId(e.target.value)}>
          {agentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #2a1f18" }}>
        {(["lembrete_reuniao", "reengajamento"] as const).map(t => (
          <button key={t} className={`fu-tab${tab === t ? " fu-tab-active" : ""}`} onClick={() => setTab(t)}>
            {t === "lembrete_reuniao" ? "◷ Lembretes de Reunião" : "◑ Reengajamento por Inatividade"}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#4a3e30", fontSize: 13 }}>Carregando...</p>
      ) : (
        <>
          {/* Lista */}
          {tab === "lembrete_reuniao" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "#4a3e30", marginBottom: 12 }}>
                  Enviados automaticamente X horas antes da reunião agendada.
                </p>
                <button className="fu-btn-add" onClick={() => novoModal("lembrete_reuniao")}>+ Novo lembrete</button>
              </div>
              {lembretes.length === 0 && <p style={{ color: "#4a3e30", fontSize: 13 }}>Nenhum lembrete configurado.</p>}
              {lembretes.map(c => (
                <ConfigCard key={c.id} cfg={c} saving={saving === c.id}
                  onEdit={() => setModal({ ...c })}
                  onToggle={() => toggleAtivo(c)}
                  onDelete={() => excluir(c.id)}
                  label={`${c.horas_antes}h antes da reunião`}
                />
              ))}
            </div>
          )}

          {tab === "reengajamento" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "#4a3e30", marginBottom: 12 }}>
                  Disparados quando o lead fica X horas sem responder o agente.
                </p>
                <button className="fu-btn-add" onClick={() => novoModal("reengajamento")}>+ Novo reengajamento</button>
              </div>
              {reengajamentos.length === 0 && <p style={{ color: "#4a3e30", fontSize: 13 }}>Nenhum reengajamento configurado.</p>}
              {reengajamentos.map(c => (
                <ConfigCard key={c.id} cfg={c} saving={saving === c.id}
                  onEdit={() => setModal({ ...c })}
                  onToggle={() => toggleAtivo(c)}
                  onDelete={() => excluir(c.id)}
                  label={`${c.horas_sem_resposta}h sem resposta`}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fu-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="fu-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff9e6" }}>
                {modal.id ? "Editar" : "Novo"} {modal.tipo === "lembrete_reuniao" ? "Lembrete" : "Reengajamento"}
              </h2>
              <button className="fu-close" onClick={() => setModal(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fu-label">Nome</label>
                <input className="fu-input" value={modal.nome ?? ""} onChange={e => setModal(m => ({ ...m!, nome: e.target.value }))} placeholder="Ex: Lembrete 24h antes" />
              </div>

              {modal.tipo === "lembrete_reuniao" && (
                <div>
                  <label className="fu-label">Horas antes da reunião</label>
                  <input className="fu-input" type="number" min={1} value={modal.horas_antes ?? ""} onChange={e => setModal(m => ({ ...m!, horas_antes: Number(e.target.value) }))} placeholder="Ex: 24" />
                </div>
              )}

              {modal.tipo === "reengajamento" && (
                <div>
                  <label className="fu-label">Horas sem resposta do lead</label>
                  <input className="fu-input" type="number" min={1} value={modal.horas_sem_resposta ?? ""} onChange={e => setModal(m => ({ ...m!, horas_sem_resposta: Number(e.target.value) }))} placeholder="Ex: 2" />
                </div>
              )}

              <div>
                <label className="fu-label">Mensagem</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {VARIAVEIS.map(v => (
                    <button key={v} className="fu-chip" onClick={() => inserirVariavel(v)}>{v}</button>
                  ))}
                </div>
                <textarea className="fu-textarea" rows={5} value={modal.mensagem ?? ""}
                  onChange={e => setModal(m => ({ ...m!, mensagem: e.target.value }))}
                  placeholder="Mensagem que será enviada ao lead..." />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="ativo-chk" checked={modal.ativo ?? true} onChange={e => setModal(m => ({ ...m!, ativo: e.target.checked }))} style={{ accentColor: "#c2904d" }} />
                <label htmlFor="ativo-chk" style={{ fontSize: 13, color: "#c8b99a", cursor: "pointer" }}>Ativo</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="fu-btn-cancel" onClick={() => setModal(null)}>Cancelar</button>
              <button className="fu-btn-save" onClick={salvar} disabled={saving === "save"}>
                {saving === "save" ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigCard({ cfg, label, saving, onEdit, onToggle, onDelete }: {
  cfg: FollowupConfig; label: string; saving: boolean;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div className={`fu-card${!cfg.ativo ? " fu-card-off" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: cfg.ativo ? "#fff9e6" : "#4a3e30" }}>{cfg.nome || "(sem nome)"}</span>
            <span className={`fu-badge${cfg.ativo ? "" : " fu-badge-off"}`}>{cfg.ativo ? "Ativo" : "Inativo"}</span>
            <span className="fu-badge-time">{label}</span>
          </div>
          <p style={{ fontSize: 12, color: "#4a3e30", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 4, lineHeight: 1.5 }}>
            {cfg.mensagem?.slice(0, 120)}{(cfg.mensagem?.length ?? 0) > 120 ? "..." : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
          <button className="fu-icon-btn" title={cfg.ativo ? "Desativar" : "Ativar"} onClick={onToggle} disabled={saving}>
            {cfg.ativo ? "⏸" : "▶"}
          </button>
          <button className="fu-icon-btn" title="Editar" onClick={onEdit}>✎</button>
          <button className="fu-icon-btn fu-icon-del" title="Excluir" onClick={onDelete} disabled={saving}>✕</button>
        </div>
      </div>
    </div>
  );
}

const css = `
  .fu-select{background:#1a170f;border:1px solid #2a1f18;color:#c8b99a;padding:8px 12px;border-radius:8px;font-size:13px;outline:none;cursor:pointer;}
  .fu-select:focus{border-color:#c2904d;}
  .fu-tab{background:none;border:none;border-bottom:2px solid transparent;color:#4a3e30;font-size:13px;padding:10px 16px;cursor:pointer;transition:color .15s,border-color .15s;margin-bottom:-1px;font-family:inherit;}
  .fu-tab:hover{color:#c8b99a;}
  .fu-tab-active{color:#c2904d;border-bottom-color:#c2904d;}
  .fu-btn-add{background:rgba(194,144,77,.12);border:1px solid rgba(194,144,77,.25);color:#c2904d;padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;transition:background .15s;}
  .fu-btn-add:hover{background:rgba(194,144,77,.2);}
  .fu-card{background:#111009;border:1px solid #2a1f18;border-radius:12px;padding:16px 18px;margin-bottom:10px;transition:border-color .15s;}
  .fu-card:hover{border-color:#3a2f20;}
  .fu-card-off{opacity:.55;}
  .fu-badge{display:inline-block;font-size:10px;padding:2px 7px;border-radius:99px;background:rgba(52,211,153,.1);color:#34d399;font-weight:600;}
  .fu-badge-off{background:rgba(100,100,100,.1);color:#4a3e30;}
  .fu-badge-time{display:inline-block;font-size:11px;padding:2px 8px;border-radius:99px;background:rgba(194,144,77,.1);color:#c2904d;}
  .fu-icon-btn{background:none;border:1px solid #2a1f18;color:#4a3e30;width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;}
  .fu-icon-btn:hover{background:rgba(255,255,255,.05);color:#c8b99a;}
  .fu-icon-btn:disabled{opacity:.4;cursor:default;}
  .fu-icon-del:hover{background:rgba(239,68,68,.1);color:#ef4444;border-color:rgba(239,68,68,.2);}
  .fu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
  .fu-modal{background:#111009;border:1px solid #2a1f18;border-radius:16px;padding:28px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;}
  .fu-close{background:none;border:none;color:#4a3e30;font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px;}
  .fu-close:hover{color:#c8b99a;}
  .fu-label{display:block;font-size:12px;color:#7a6e5e;margin-bottom:5px;font-weight:500;}
  .fu-input{width:100%;background:#0e0f09;border:1px solid #2a1f18;color:#fff9e6;padding:10px 12px;border-radius:8px;font-size:13px;outline:none;font-family:inherit;}
  .fu-input:focus{border-color:#c2904d;}
  .fu-textarea{width:100%;background:#0e0f09;border:1px solid #2a1f18;color:#fff9e6;padding:10px 12px;border-radius:8px;font-size:13px;outline:none;font-family:inherit;resize:vertical;line-height:1.6;}
  .fu-textarea:focus{border-color:#c2904d;}
  .fu-chip{background:rgba(194,144,77,.1);border:1px solid rgba(194,144,77,.2);color:#c2904d;font-size:11px;padding:3px 8px;border-radius:6px;cursor:pointer;transition:background .15s;font-family:inherit;}
  .fu-chip:hover{background:rgba(194,144,77,.2);}
  .fu-btn-cancel{background:none;border:1px solid #2a1f18;color:#7a6e5e;padding:9px 18px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;}
  .fu-btn-cancel:hover{color:#c8b99a;border-color:#3a2f20;}
  .fu-btn-save{background:#c2904d;border:none;color:#0e0f09;padding:9px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;font-family:inherit;}
  .fu-btn-save:hover:not(:disabled){background:#d4a060;}
  .fu-btn-save:disabled{opacity:.5;cursor:default;}
`;

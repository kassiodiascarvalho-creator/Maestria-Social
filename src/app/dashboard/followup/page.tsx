"use client";

import { useState, useEffect, useCallback } from "react";

type Agente = { id: string; nome: string };

type Fluxo = {
  id: string;
  agente_id: string;
  nome: string;
  tipo: "inatividade" | "interacao" | "lembrete_reuniao" | "personalizado";
  ativo: boolean;
  ao_finalizar: "parar" | "proximo_fluxo";
  fluxo_destino_id: string | null;
  condicao_parada: string | null;
  criado_em: string;
  followup_configs: MensagemFluxo[];
};

type MensagemFluxo = {
  id: string;
  nome: string;
  ordem: number;
  horas_apos: number | null;
  horas_sem_resposta: number | null;
  mensagem: string;
  ativo: boolean;
};

type LegacyConfig = {
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

const TIPO_LABELS: Record<string, string> = {
  inatividade: "◑ Inatividade",
  interacao: "◎ Interação",
  lembrete_reuniao: "◷ Lembrete",
  personalizado: "✦ Personalizado",
};

const TIPO_CORES: Record<string, string> = {
  inatividade: "#c2904d",
  interacao:   "#34d399",
  lembrete_reuniao: "#60a5fa",
  personalizado: "#a78bfa",
};

function formatarTempo(horas: number | null | undefined): string {
  if (horas == null) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas === 1) return "1h";
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return resto ? `${dias}d ${resto}h` : `${dias} dia${dias > 1 ? "s" : ""}`;
}

function horasParaInput(horas: number | null, unidade: "minutos" | "horas"): string {
  if (horas == null) return "";
  return String(unidade === "minutos" ? Math.round(horas * 60) : horas);
}

export default function FollowupPage() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [agenteId, setAgenteId] = useState<string>("");
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [legacyConfigs, setLegacyConfigs] = useState<LegacyConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"lembretes" | "sequencias">("sequencias");

  // Modal fluxo
  const [modalFluxo, setModalFluxo] = useState<Partial<Fluxo> | null>(null);
  const [savingFluxo, setSavingFluxo] = useState(false);

  // Modal mensagem
  const [modalMsg, setModalMsg] = useState<{ fluxoId: string; msg: Partial<MensagemFluxo> } | null>(null);
  const [modalMsgUnidade, setModalMsgUnidade] = useState<"minutos" | "horas">("horas");
  const [savingMsg, setSavingMsg] = useState(false);

  // Modal lembrete legado
  const [modalLegacy, setModalLegacy] = useState<Partial<LegacyConfig> | null>(null);
  const [modalLegacyUnidade, setModalLegacyUnidade] = useState<"minutos" | "horas">("horas");
  const [savingLegacy, setSavingLegacy] = useState(false);

  const [expandido, setExpandido] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/agentes").then(r => r.json()).then((data) => {
      const list = Array.isArray(data) ? data : [];
      setAgentes(list);
      if (list.length) setAgenteId(list[0].id);
    }).catch(() => {});
  }, []);

  const carregar = useCallback(() => {
    if (!agenteId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/followup/fluxos?agente_id=${agenteId}`).then(r => r.json()),
      fetch(`/api/admin/followup/configs?agente_id=${agenteId}`).then(r => r.json()),
    ]).then(([fluxosData, configsData]) => {
      setFluxos(Array.isArray(fluxosData) ? fluxosData : []);
      // legacyConfigs = configs sem fluxo_id
      const legacy = (Array.isArray(configsData) ? configsData : [])
        .filter((c: LegacyConfig & { fluxo_id?: string }) => !c.fluxo_id);
      setLegacyConfigs(legacy);
    }).catch(() => {
      setFluxos([]); setLegacyConfigs([]);
    }).finally(() => setLoading(false));
  }, [agenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Fluxos CRUD ────────────────────────────────────────────────────────────
  async function salvarFluxo() {
    if (!modalFluxo) return;
    setSavingFluxo(true);
    const body = { ...modalFluxo, agente_id: agenteId };
    const isNew = !modalFluxo.id;
    await fetch(
      isNew ? "/api/admin/followup/fluxos" : `/api/admin/followup/fluxos/${modalFluxo.id}`,
      { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    setSavingFluxo(false);
    setModalFluxo(null);
    carregar();
  }

  async function toggleFluxoAtivo(fluxo: Fluxo) {
    setSaving(fluxo.id);
    await fetch(`/api/admin/followup/fluxos/${fluxo.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !fluxo.ativo }),
    });
    setSaving(null);
    carregar();
  }

  async function excluirFluxo(id: string) {
    if (!confirm("Excluir este fluxo e todas as mensagens?")) return;
    setSaving(id);
    await fetch(`/api/admin/followup/fluxos/${id}`, { method: "DELETE" });
    setSaving(null);
    carregar();
  }

  // ── Mensagens CRUD ─────────────────────────────────────────────────────────
  function abrirNovaMsg(fluxoId: string) {
    const msgs = fluxos.find(f => f.id === fluxoId)?.followup_configs ?? [];
    const proximaOrdem = msgs.length > 0 ? Math.max(...msgs.map(m => m.ordem)) + 1 : 0;
    setModalMsgUnidade("horas");
    setModalMsg({ fluxoId, msg: { nome: "", mensagem: "", horas_apos: 1, ativo: true, ordem: proximaOrdem } });
  }

  async function salvarMsg() {
    if (!modalMsg) return;
    setSavingMsg(true);
    const { fluxoId, msg } = modalMsg;
    const body = { ...msg, fluxo_id: fluxoId, agente_id: agenteId, tipo: "reengajamento" };
    const isNew = !msg.id;
    await fetch(
      isNew ? "/api/admin/followup/configs" : `/api/admin/followup/configs/${msg.id}`,
      { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    setSavingMsg(false);
    setModalMsg(null);
    carregar();
  }

  async function excluirMsg(id: string) {
    if (!confirm("Excluir esta mensagem?")) return;
    setSaving(id);
    await fetch(`/api/admin/followup/configs/${id}`, { method: "DELETE" });
    setSaving(null);
    carregar();
  }

  // ── Legacy (lembretes) ─────────────────────────────────────────────────────
  async function salvarLegacy() {
    if (!modalLegacy) return;
    setSavingLegacy(true);
    const body = { ...modalLegacy, agente_id: agenteId };
    const isNew = !modalLegacy.id;
    await fetch(
      isNew ? "/api/admin/followup/configs" : `/api/admin/followup/configs/${modalLegacy.id}`,
      { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    setSavingLegacy(false);
    setModalLegacy(null);
    carregar();
  }

  async function toggleLegacyAtivo(cfg: LegacyConfig) {
    setSaving(cfg.id);
    await fetch(`/api/admin/followup/configs/${cfg.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !cfg.ativo }),
    });
    setSaving(null);
    carregar();
  }

  async function excluirLegacy(id: string) {
    if (!confirm("Excluir este lembrete?")) return;
    setSaving(id);
    await fetch(`/api/admin/followup/configs/${id}`, { method: "DELETE" });
    setSaving(null);
    carregar();
  }

  const lembretes = legacyConfigs.filter(c => c.tipo === "lembrete_reuniao")
    .sort((a, b) => (a.horas_antes ?? 0) - (b.horas_antes ?? 0));

  return (
    <div style={{ padding: "32px 28px", maxWidth: 940, margin: "0 auto" }}>
      <style>{css}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff9e6", marginBottom: 4 }}>Follow-up Automático</h1>
        <p style={{ fontSize: 13, color: "#7a6e5e" }}>Lembretes de reunião e sequências de mensagens automáticas</p>
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
        <button className={`fu-tab${tab === "lembretes" ? " fu-tab-active" : ""}`} onClick={() => setTab("lembretes")}>
          ◷ Lembretes de Reunião
        </button>
        <button className={`fu-tab${tab === "sequencias" ? " fu-tab-active" : ""}`} onClick={() => setTab("sequencias")}>
          ◑ Sequências de Follow-up
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#4a3e30", fontSize: 13 }}>Carregando...</p>
      ) : (
        <>
          {/* ── Tab Lembretes ── */}
          {tab === "lembretes" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "#4a3e30", marginBottom: 12 }}>
                  Enviados automaticamente X horas antes da reunião agendada.
                </p>
                <button className="fu-btn-add" onClick={() => {
                  setModalLegacyUnidade("horas");
                  setModalLegacy({ agente_id: null, nome: "", tipo: "lembrete_reuniao", ativo: true, horas_antes: 24, horas_sem_resposta: null, mensagem: "", ordem: 0 });
                }}>+ Novo lembrete</button>
              </div>
              {lembretes.length === 0 && <p style={{ color: "#4a3e30", fontSize: 13 }}>Nenhum lembrete configurado.</p>}
              {lembretes.map(c => (
                <div key={c.id} className={`fu-card${!c.ativo ? " fu-card-off" : ""}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: c.ativo ? "#fff9e6" : "#4a3e30" }}>{c.nome || "(sem nome)"}</span>
                        <span className={`fu-badge${c.ativo ? "" : " fu-badge-off"}`}>{c.ativo ? "Ativo" : "Inativo"}</span>
                        <span className="fu-badge-time">{formatarTempo(c.horas_antes)} antes</span>
                      </div>
                      <p style={{ fontSize: 12, color: "#4a3e30", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 4, lineHeight: 1.5 }}>
                        {c.mensagem?.slice(0, 120)}{(c.mensagem?.length ?? 0) > 120 ? "..." : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                      <button className="fu-icon-btn" onClick={() => toggleLegacyAtivo(c)} disabled={saving === c.id}>{c.ativo ? "⏸" : "▶"}</button>
                      <button className="fu-icon-btn" onClick={() => { setModalLegacyUnidade(c.horas_antes != null && c.horas_antes < 1 ? "minutos" : "horas"); setModalLegacy({ ...c }); }}>✎</button>
                      <button className="fu-icon-btn fu-icon-del" onClick={() => excluirLegacy(c.id)} disabled={saving === c.id}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab Sequências ── */}
          {tab === "sequencias" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: "#4a3e30" }}>
                  Sequências automáticas de mensagens. Leads entram quando ficam sem responder (Inatividade) ou quando respondem (Interação).
                </p>
                <button className="fu-btn-add" style={{ flexShrink: 0, marginLeft: 16 }} onClick={() => setModalFluxo({
                  nome: "", tipo: "inatividade", ativo: true, ao_finalizar: "parar", fluxo_destino_id: null, condicao_parada: null,
                })}>+ Novo fluxo</button>
              </div>

              {fluxos.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#4a3e30" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>◑</div>
                  <p style={{ fontSize: 14, marginBottom: 8 }}>Nenhum fluxo criado ainda</p>
                  <p style={{ fontSize: 12 }}>Crie um fluxo de Inatividade ou Interação para começar</p>
                </div>
              )}

              {fluxos.map(fluxo => (
                <div key={fluxo.id} className="fu-fluxo-card">
                  {/* Header do fluxo */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: expandido === fluxo.id ? 16 : 0 }}>
                    <button
                      className="fu-expand-btn"
                      onClick={() => setExpandido(expandido === fluxo.id ? null : fluxo.id)}
                    >
                      {expandido === fluxo.id ? "▾" : "▸"}
                    </button>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: fluxo.ativo ? "#fff9e6" : "#4a3e30" }}>{fluxo.nome}</span>
                        <span className="fu-tipo-badge" style={{ background: `${TIPO_CORES[fluxo.tipo]}20`, color: TIPO_CORES[fluxo.tipo], border: `1px solid ${TIPO_CORES[fluxo.tipo]}40` }}>
                          {TIPO_LABELS[fluxo.tipo]}
                        </span>
                        {!fluxo.ativo && <span className="fu-badge fu-badge-off">Inativo</span>}
                        <span style={{ fontSize: 11, color: "#4a3e30" }}>
                          {fluxo.followup_configs?.length ?? 0} mensagem{(fluxo.followup_configs?.length ?? 0) !== 1 ? "s" : ""}
                        </span>
                        {fluxo.condicao_parada === "agendamento" && (
                          <span style={{ fontSize: 10, color: "#60a5fa", background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.2)", borderRadius: 6, padding: "1px 6px" }}>
                            Para ao agendar
                          </span>
                        )}
                        {fluxo.ao_finalizar === "proximo_fluxo" && fluxo.fluxo_destino_id && (
                          <span style={{ fontSize: 10, color: "#a78bfa", background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 6, padding: "1px 6px" }}>
                            → {fluxos.find(f => f.id === fluxo.fluxo_destino_id)?.nome ?? "outro fluxo"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="fu-icon-btn" title={fluxo.ativo ? "Desativar" : "Ativar"} onClick={() => toggleFluxoAtivo(fluxo)} disabled={saving === fluxo.id}>
                        {fluxo.ativo ? "⏸" : "▶"}
                      </button>
                      <button className="fu-icon-btn" title="Configurar fluxo" onClick={() => setModalFluxo({ ...fluxo })}>⚙</button>
                      <button className="fu-icon-btn fu-icon-del" title="Excluir fluxo" onClick={() => excluirFluxo(fluxo.id)} disabled={saving === fluxo.id}>✕</button>
                    </div>
                  </div>

                  {/* Mensagens do fluxo */}
                  {expandido === fluxo.id && (
                    <div style={{ paddingLeft: 28 }}>
                      {fluxo.tipo === "interacao" && (
                        <div style={{ fontSize: 11, color: "#4a3e30", marginBottom: 12, padding: "8px 12px", background: "rgba(52,211,153,.05)", border: "1px solid rgba(52,211,153,.1)", borderRadius: 8 }}>
                          Lead entra neste fluxo automaticamente quando responde qualquer mensagem de outro fluxo.
                        </div>
                      )}
                      {fluxo.tipo === "inatividade" && (
                        <div style={{ fontSize: 11, color: "#4a3e30", marginBottom: 12, padding: "8px 12px", background: "rgba(194,144,77,.05)", border: "1px solid rgba(194,144,77,.1)", borderRadius: 8 }}>
                          Lead entra neste fluxo quando não responde após a primeira mensagem configurada.
                        </div>
                      )}

                      {(fluxo.followup_configs ?? []).length === 0 && (
                        <p style={{ fontSize: 12, color: "#4a3e30", marginBottom: 12 }}>Nenhuma mensagem ainda. Adicione a primeira abaixo.</p>
                      )}

                      {(fluxo.followup_configs ?? [])
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((msg, idx) => (
                          <div key={msg.id} className={`fu-msg-item${!msg.ativo ? " fu-card-off" : ""}`}>
                            <div className="fu-msg-ordem">{idx + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: msg.ativo ? "#c8b99a" : "#4a3e30" }}>{msg.nome || `Mensagem ${idx + 1}`}</span>
                                <span className="fu-badge-time">
                                  {idx === 0 ? "Após entrada no fluxo: " : "Após anterior: "}
                                  {formatarTempo(msg.horas_apos ?? msg.horas_sem_resposta)}
                                </span>
                              </div>
                              <p style={{ fontSize: 12, color: "#4a3e30", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                {msg.mensagem?.slice(0, 100)}{(msg.mensagem?.length ?? 0) > 100 ? "..." : ""}
                              </p>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <button className="fu-icon-btn" onClick={() => {
                                const h = msg.horas_apos ?? msg.horas_sem_resposta;
                                setModalMsgUnidade(h != null && h < 1 ? "minutos" : "horas");
                                setModalMsg({ fluxoId: fluxo.id, msg: { ...msg } });
                              }}>✎</button>
                              <button className="fu-icon-btn fu-icon-del" onClick={() => excluirMsg(msg.id)} disabled={saving === msg.id}>✕</button>
                            </div>
                          </div>
                        ))}

                      <button className="fu-btn-add-msg" onClick={() => abrirNovaMsg(fluxo.id)}>
                        + Adicionar mensagem
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modal: Criar/Editar Fluxo ── */}
      {modalFluxo && (
        <div className="fu-overlay" onClick={e => { if (e.target === e.currentTarget) setModalFluxo(null); }}>
          <div className="fu-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff9e6" }}>
                {modalFluxo.id ? "Configurar Fluxo" : "Novo Fluxo"}
              </h2>
              <button className="fu-close" onClick={() => setModalFluxo(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fu-label">Nome do fluxo</label>
                <input className="fu-input" value={modalFluxo.nome ?? ""} onChange={e => setModalFluxo(m => ({ ...m!, nome: e.target.value }))} placeholder="Ex: Reengajamento 7 dias" />
              </div>

              <div>
                <label className="fu-label">Tipo</label>
                <select className="fu-input" value={modalFluxo.tipo ?? "inatividade"} onChange={e => setModalFluxo(m => ({ ...m!, tipo: e.target.value as Fluxo["tipo"] }))}>
                  <option value="inatividade">◑ Inatividade — lead não responde</option>
                  <option value="interacao">◎ Interação — lead respondeu</option>
                  <option value="personalizado">✦ Personalizado</option>
                </select>
                {modalFluxo.tipo === "interacao" && (
                  <p style={{ fontSize: 11, color: "#34d399", marginTop: 6 }}>Lead entra automaticamente quando responde qualquer mensagem de outro fluxo.</p>
                )}
              </div>

              <div>
                <label className="fu-label">Condição de parada</label>
                <select className="fu-input" value={modalFluxo.condicao_parada ?? ""} onChange={e => setModalFluxo(m => ({ ...m!, condicao_parada: e.target.value || null }))}>
                  <option value="">Nenhuma — percorre todas as mensagens</option>
                  <option value="agendamento">Parar quando o lead fizer um agendamento</option>
                </select>
              </div>

              <div style={{ borderTop: "1px solid #2a1f18", paddingTop: 14 }}>
                <label className="fu-label" style={{ marginBottom: 10 }}>Ao finalizar o fluxo</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(["parar", "proximo_fluxo"] as const).map(op => (
                    <label key={op} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <input type="radio" name="ao_finalizar" checked={modalFluxo.ao_finalizar === op}
                        onChange={() => setModalFluxo(m => ({ ...m!, ao_finalizar: op }))}
                        style={{ accentColor: "#c2904d" }} />
                      <span style={{ fontSize: 13, color: "#c8b99a" }}>
                        {op === "parar" ? "Parar — não enviar mais mensagens" : "Ir para outro fluxo"}
                      </span>
                    </label>
                  ))}
                </div>

                {modalFluxo.ao_finalizar === "proximo_fluxo" && (
                  <div style={{ marginTop: 10 }}>
                    <label className="fu-label">Qual fluxo?</label>
                    <select className="fu-input" value={modalFluxo.fluxo_destino_id ?? ""} onChange={e => setModalFluxo(m => ({ ...m!, fluxo_destino_id: e.target.value || null }))}>
                      <option value="">Selecione...</option>
                      {fluxos.filter(f => f.id !== modalFluxo.id).map(f => (
                        <option key={f.id} value={f.id}>{f.nome} ({TIPO_LABELS[f.tipo]})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="fluxo-ativo" checked={modalFluxo.ativo ?? true} onChange={e => setModalFluxo(m => ({ ...m!, ativo: e.target.checked }))} style={{ accentColor: "#c2904d" }} />
                <label htmlFor="fluxo-ativo" style={{ fontSize: 13, color: "#c8b99a", cursor: "pointer" }}>Fluxo ativo</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="fu-btn-cancel" onClick={() => setModalFluxo(null)}>Cancelar</button>
              <button className="fu-btn-save" onClick={salvarFluxo} disabled={savingFluxo}>
                {savingFluxo ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Criar/Editar Mensagem do Fluxo ── */}
      {modalMsg && (
        <div className="fu-overlay" onClick={e => { if (e.target === e.currentTarget) setModalMsg(null); }}>
          <div className="fu-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff9e6" }}>
                {modalMsg.msg.id ? "Editar mensagem" : "Nova mensagem"}
              </h2>
              <button className="fu-close" onClick={() => setModalMsg(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fu-label">Nome (interno)</label>
                <input className="fu-input" value={modalMsg.msg.nome ?? ""} onChange={e => setModalMsg(m => ({ ...m!, msg: { ...m!.msg, nome: e.target.value } }))} placeholder="Ex: Follow-up 1h" />
              </div>

              <div>
                <label className="fu-label">
                  {(modalMsg.msg.ordem ?? 0) === 0 ? "Enviar após entrar no fluxo" : "Enviar após mensagem anterior"}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="fu-input" type="number" min={1} style={{ flex: 1 }}
                    value={horasParaInput(modalMsg.msg.horas_apos ?? null, modalMsgUnidade)}
                    onChange={e => {
                      const n = Number(e.target.value);
                      setModalMsg(m => ({ ...m!, msg: { ...m!.msg, horas_apos: modalMsgUnidade === "minutos" ? n / 60 : n } }));
                    }}
                    placeholder={modalMsgUnidade === "minutos" ? "Ex: 60" : "Ex: 1"} />
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["minutos", "horas"] as const).map(u => (
                      <button key={u} className={`fu-unit-btn${modalMsgUnidade === u ? " fu-unit-active" : ""}`} onClick={() => setModalMsgUnidade(u)}>
                        {u === "minutos" ? "min" : "hrs"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="fu-label">Mensagem</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {VARIAVEIS.slice(0, 2).map(v => (
                    <button key={v} className="fu-chip" onClick={() => setModalMsg(m => ({ ...m!, msg: { ...m!.msg, mensagem: (m!.msg.mensagem ?? "") + v } }))}>{v}</button>
                  ))}
                  <button className="fu-chip" onClick={() => setModalMsg(m => ({ ...m!, msg: { ...m!.msg, mensagem: (m!.msg.mensagem ?? "") + "{pilar_fraco}" } }))}>
                    {"{pilar_fraco}"}
                  </button>
                </div>
                <textarea className="fu-textarea" rows={5} value={modalMsg.msg.mensagem ?? ""}
                  onChange={e => setModalMsg(m => ({ ...m!, msg: { ...m!.msg, mensagem: e.target.value } }))}
                  placeholder="Mensagem que será enviada ao lead..." />
              </div>

              <div>
                <label className="fu-label">Posição na sequência</label>
                <input className="fu-input" type="number" min={0}
                  value={modalMsg.msg.ordem ?? 0}
                  onChange={e => setModalMsg(m => ({ ...m!, msg: { ...m!.msg, ordem: Number(e.target.value) } }))} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="msg-ativa" checked={modalMsg.msg.ativo ?? true} onChange={e => setModalMsg(m => ({ ...m!, msg: { ...m!.msg, ativo: e.target.checked } }))} style={{ accentColor: "#c2904d" }} />
                <label htmlFor="msg-ativa" style={{ fontSize: 13, color: "#c8b99a", cursor: "pointer" }}>Mensagem ativa</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="fu-btn-cancel" onClick={() => setModalMsg(null)}>Cancelar</button>
              <button className="fu-btn-save" onClick={salvarMsg} disabled={savingMsg}>
                {savingMsg ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Lembrete legado ── */}
      {modalLegacy && (
        <div className="fu-overlay" onClick={e => { if (e.target === e.currentTarget) setModalLegacy(null); }}>
          <div className="fu-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff9e6" }}>
                {modalLegacy.id ? "Editar Lembrete" : "Novo Lembrete"}
              </h2>
              <button className="fu-close" onClick={() => setModalLegacy(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fu-label">Nome</label>
                <input className="fu-input" value={modalLegacy.nome ?? ""} onChange={e => setModalLegacy(m => ({ ...m!, nome: e.target.value }))} placeholder="Ex: Lembrete 24h antes" />
              </div>

              <div>
                <label className="fu-label">Quanto tempo antes da reunião</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="fu-input" type="number" min={1} style={{ flex: 1 }}
                    value={horasParaInput(modalLegacy.horas_antes ?? null, modalLegacyUnidade)}
                    onChange={e => { const n = Number(e.target.value); setModalLegacy(m => ({ ...m!, horas_antes: modalLegacyUnidade === "minutos" ? n / 60 : n })); }}
                    placeholder={modalLegacyUnidade === "minutos" ? "Ex: 30" : "Ex: 24"} />
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["minutos", "horas"] as const).map(u => (
                      <button key={u} className={`fu-unit-btn${modalLegacyUnidade === u ? " fu-unit-active" : ""}`} onClick={() => setModalLegacyUnidade(u)}>
                        {u === "minutos" ? "min" : "hrs"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="fu-label">Mensagem</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                  {VARIAVEIS.map(v => (
                    <button key={v} className="fu-chip" onClick={() => setModalLegacy(m => ({ ...m!, mensagem: (m!.mensagem ?? "") + v }))}>{v}</button>
                  ))}
                </div>
                <textarea className="fu-textarea" rows={5} value={modalLegacy.mensagem ?? ""}
                  onChange={e => setModalLegacy(m => ({ ...m!, mensagem: e.target.value }))}
                  placeholder="Mensagem que será enviada ao lead..." />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="legacy-ativo" checked={modalLegacy.ativo ?? true} onChange={e => setModalLegacy(m => ({ ...m!, ativo: e.target.checked }))} style={{ accentColor: "#c2904d" }} />
                <label htmlFor="legacy-ativo" style={{ fontSize: 13, color: "#c8b99a", cursor: "pointer" }}>Ativo</label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="fu-btn-cancel" onClick={() => setModalLegacy(null)}>Cancelar</button>
              <button className="fu-btn-save" onClick={salvarLegacy} disabled={savingLegacy}>
                {savingLegacy ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const css = `
  .fu-select{background:#1a170f;border:1px solid #2a1f18;color:#c8b99a;padding:8px 12px;border-radius:8px;font-size:13px;outline:none;cursor:pointer;}
  .fu-select:focus{border-color:#c2904d;}
  .fu-tab{background:none;border:none;border-bottom:2px solid transparent;color:#4a3e30;font-size:13px;padding:10px 16px;cursor:pointer;transition:color .15s,border-color .15s;margin-bottom:-1px;font-family:inherit;}
  .fu-tab:hover{color:#c8b99a;}
  .fu-tab-active{color:#c2904d;border-bottom-color:#c2904d;}
  .fu-btn-add{background:rgba(194,144,77,.12);border:1px solid rgba(194,144,77,.25);color:#c2904d;padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;transition:background .15s;white-space:nowrap;}
  .fu-btn-add:hover{background:rgba(194,144,77,.2);}
  .fu-card{background:#111009;border:1px solid #2a1f18;border-radius:12px;padding:16px 18px;margin-bottom:10px;transition:border-color .15s;}
  .fu-card:hover{border-color:#3a2f20;}
  .fu-card-off{opacity:.5;}
  .fu-fluxo-card{background:#111009;border:1px solid #2a1f18;border-radius:12px;padding:16px 18px;margin-bottom:12px;transition:border-color .15s;}
  .fu-fluxo-card:hover{border-color:#3a2f20;}
  .fu-expand-btn{background:none;border:none;color:#4a3e30;font-size:14px;cursor:pointer;padding:0 6px 0 0;transition:color .15s;flex-shrink:0;}
  .fu-expand-btn:hover{color:#c2904d;}
  .fu-msg-item{display:flex;align-items:flex-start;gap:12px;background:#0e0f09;border:1px solid #2a1f18;border-radius:10px;padding:12px 14px;margin-bottom:8px;transition:border-color .15s;}
  .fu-msg-item:hover{border-color:#3a2f20;}
  .fu-msg-ordem{width:22px;height:22px;background:#2a1f18;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#c2904d;flex-shrink:0;margin-top:1px;}
  .fu-btn-add-msg{background:none;border:1px dashed #2a1f18;color:#4a3e30;padding:8px 16px;border-radius:8px;font-size:12px;cursor:pointer;width:100%;margin-top:8px;font-family:inherit;transition:color .15s,border-color .15s;}
  .fu-btn-add-msg:hover{color:#c2904d;border-color:rgba(194,144,77,.3);}
  .fu-badge{display:inline-block;font-size:10px;padding:2px 7px;border-radius:99px;background:rgba(52,211,153,.1);color:#34d399;font-weight:600;}
  .fu-badge-off{background:rgba(100,100,100,.1)!important;color:#4a3e30!important;}
  .fu-badge-time{display:inline-block;font-size:11px;padding:2px 8px;border-radius:99px;background:rgba(194,144,77,.1);color:#c2904d;}
  .fu-tipo-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;}
  .fu-icon-btn{background:none;border:1px solid #2a1f18;color:#4a3e30;width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s;}
  .fu-icon-btn:hover{background:rgba(255,255,255,.05);color:#c8b99a;}
  .fu-icon-btn:disabled{opacity:.4;cursor:default;}
  .fu-icon-del:hover{background:rgba(239,68,68,.1)!important;color:#ef4444!important;border-color:rgba(239,68,68,.2)!important;}
  .fu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
  .fu-modal{background:#111009;border:1px solid #2a1f18;border-radius:16px;padding:28px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;}
  .fu-close{background:none;border:none;color:#4a3e30;font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px;}
  .fu-close:hover{color:#c8b99a;}
  .fu-label{display:block;font-size:12px;color:#7a6e5e;margin-bottom:5px;font-weight:500;}
  .fu-input{width:100%;background:#0e0f09;border:1px solid #2a1f18;color:#fff9e6;padding:10px 12px;border-radius:8px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;}
  .fu-input:focus{border-color:#c2904d;}
  .fu-textarea{width:100%;background:#0e0f09;border:1px solid #2a1f18;color:#fff9e6;padding:10px 12px;border-radius:8px;font-size:13px;outline:none;font-family:inherit;resize:vertical;line-height:1.6;box-sizing:border-box;}
  .fu-textarea:focus{border-color:#c2904d;}
  .fu-chip{background:rgba(194,144,77,.1);border:1px solid rgba(194,144,77,.2);color:#c2904d;font-size:11px;padding:3px 8px;border-radius:6px;cursor:pointer;transition:background .15s;font-family:inherit;}
  .fu-chip:hover{background:rgba(194,144,77,.2);}
  .fu-btn-cancel{background:none;border:1px solid #2a1f18;color:#7a6e5e;padding:9px 18px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;}
  .fu-btn-cancel:hover{color:#c8b99a;border-color:#3a2f20;}
  .fu-btn-save{background:#c2904d;border:none;color:#0e0f09;padding:9px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;font-family:inherit;}
  .fu-btn-save:hover:not(:disabled){background:#d4a060;}
  .fu-btn-save:disabled{opacity:.5;cursor:default;}
  .fu-unit-btn{background:#0e0f09;border:1px solid #2a1f18;color:#4a3e30;padding:0 14px;height:42px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;transition:background .15s,color .15s,border-color .15s;white-space:nowrap;}
  .fu-unit-btn:hover{color:#c8b99a;}
  .fu-unit-active{background:rgba(194,144,77,.15)!important;border-color:rgba(194,144,77,.3)!important;color:#c2904d!important;}
`;

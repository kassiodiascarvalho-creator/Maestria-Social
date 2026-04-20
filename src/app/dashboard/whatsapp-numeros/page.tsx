"use client";

import { useEffect, useState, useCallback } from "react";

type TipoInstancia = "meta" | "baileys";
type StatusConexao = "conectado" | "configurado" | "aguardando_qr" | "erro" | "offline" | "carregando";

interface Instancia {
  id: string;
  tipo: TipoInstancia;
  label: string;
  phone: string | null;
  meta_phone_number_id: string | null;
  meta_access_token: string | null;
  meta_waba_id: string | null;
  meta_template_name: string | null;
  meta_template_language: string | null;
  baileys_instance_id: string | null;
  principal: boolean;
  ativo: boolean;
  criado_em: string;
  // campos adicionados pelo GET para itens auto-detectados
  _inline_status?: string;
  _inline_detalhe?: string | null;
  _inline_qr?: string | null;
  _auto?: boolean;
}

interface StatusInfo {
  status: StatusConexao;
  detalhe: string | null;
  qr: string | null;
}

const FORM_VAZIO_META = {
  label: "", phone: "", meta_phone_number_id: "", meta_access_token: "",
  meta_waba_id: "", meta_template_name: "", meta_template_language: "pt_BR",
};
const FORM_VAZIO_BAILEYS = { label: "" };

function isAutoId(id: string) {
  return id.startsWith("env-meta-") || id.startsWith("baileys-auto-");
}

export default function WhatsAppNumerosPage() {
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, StatusInfo>>({});
  const [carregando, setCarregando] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<TipoInstancia>("meta");
  const [formMeta, setFormMeta] = useState(FORM_VAZIO_META);
  const [formBaileys, setFormBaileys] = useState(FORM_VAZIO_BAILEYS);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");

  const [deletando, setDeletando] = useState<string | null>(null);
  const [tornandoPrincipal, setTornandoPrincipal] = useState<string | null>(null);
  const [editando, setEditando] = useState<Instancia | null>(null);

  // Calculadora de custos Meta
  const [calcContatos, setCalcContatos] = useState("1000");
  const [calcCategoria, setCalcCategoria] = useState<"marketing" | "utility" | "authentication">("marketing");

  const carregarInstancias = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp/instancias");
      if (res.ok) {
        const data: Instancia[] = await res.json();
        setInstancias(data);

        // Pré-popula statusMap com dados inline (auto-detectados) e
        // dispara busca de status para itens no DB
        const novoStatus: Record<string, StatusInfo> = {};
        data.forEach((inst) => {
          if (inst._inline_status) {
            novoStatus[inst.id] = {
              status: inst._inline_status as StatusConexao,
              detalhe: inst._inline_detalhe ?? null,
              qr: inst._inline_qr ?? null,
            };
          }
        });
        setStatusMap(novoStatus);

        // Busca status via endpoint apenas para itens do DB (UUIDs reais)
        data.filter((i) => !isAutoId(i.id)).forEach((inst) => carregarStatus(inst.id));
      }
    } finally {
      setCarregando(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarStatus(id: string) {
    setStatusMap((prev) => ({ ...prev, [id]: { status: "carregando", detalhe: null, qr: null } }));
    try {
      const res = await fetch(`/api/admin/whatsapp/instancias/${id}/status`);
      if (res.ok) {
        const data = await res.json();
        setStatusMap((prev) => ({ ...prev, [id]: data }));
      }
    } catch {
      setStatusMap((prev) => ({ ...prev, [id]: { status: "offline", detalhe: "Inacessível", qr: null } }));
    }
  }

  useEffect(() => { carregarInstancias(); }, [carregarInstancias]);

  // Polling para Baileys aguardando QR (a cada 5s — recarrega tudo pois o QR vem do GET)
  useEffect(() => {
    const aguardando = instancias.filter(
      (i) => i.tipo === "baileys" && statusMap[i.id]?.status === "aguardando_qr"
    );
    if (aguardando.length === 0) return;
    const timer = setInterval(() => {
      // Para itens auto-detectados: recarrega a lista toda (QR vem inline no GET)
      const temAuto = aguardando.some((i) => isAutoId(i.id));
      if (temAuto) carregarInstancias();
      // Para itens no DB: chama endpoint de status
      aguardando.filter((i) => !isAutoId(i.id)).forEach((i) => carregarStatus(i.id));
    }, 5000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instancias, statusMap]);

  function abrirEdicao(inst: Instancia) {
    setEditando(inst);
    setModalTab(inst.tipo);
    if (inst.tipo === "meta") {
      setFormMeta({
        label: inst.label,
        phone: inst.phone ?? "",
        meta_phone_number_id: inst.meta_phone_number_id ?? "",
        meta_access_token: inst.meta_access_token ?? "",
        meta_waba_id: inst.meta_waba_id ?? "",
        meta_template_name: inst.meta_template_name ?? "",
        meta_template_language: inst.meta_template_language ?? "pt_BR",
      });
    } else {
      setFormBaileys({ label: inst.label });
    }
    setErroForm("");
    setShowModal(true);
  }

  async function salvarInstancia() {
    setErroForm("");
    setSalvando(true);
    try {
      if (editando) {
        // Modo edição — PATCH
        const body = editando.tipo === "meta"
          ? { ...formMeta }
          : { label: formBaileys.label };
        const res = await fetch(`/api/admin/whatsapp/instancias/${editando.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setErroForm(data.error ?? "Erro ao salvar"); return; }
      } else {
        // Modo criação — POST
        const body = modalTab === "meta"
          ? { tipo: "meta", ...formMeta }
          : { tipo: "baileys", ...formBaileys };
        const res = await fetch("/api/admin/whatsapp/instancias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setErroForm(data.error ?? "Erro ao salvar"); return; }
      }

      setShowModal(false);
      setEditando(null);
      setFormMeta(FORM_VAZIO_META);
      setFormBaileys(FORM_VAZIO_BAILEYS);
      await carregarInstancias();
    } finally {
      setSalvando(false);
    }
  }

  async function definirPrincipal(id: string) {
    setTornandoPrincipal(id);
    try {
      await fetch(`/api/admin/whatsapp/instancias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ principal: true }),
      });
      await carregarInstancias();
    } finally {
      setTornandoPrincipal(null);
    }
  }

  async function deletar(id: string) {
    if (!confirm("Remover este número? Esta ação não pode ser desfeita.")) return;
    setDeletando(id);
    try {
      await fetch(`/api/admin/whatsapp/instancias/${id}`, { method: "DELETE" });
      setInstancias((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setDeletando(null);
    }
  }

  const total = instancias.length;
  const conectados = instancias.filter((i) => {
    const st = statusMap[i.id]?.status;
    return st === "conectado" || st === "configurado";
  }).length;
  const numMeta = instancias.filter((i) => i.tipo === "meta").length;
  const numBaileys = instancias.filter((i) => i.tipo === "baileys").length;

  return (
    <>
      <style>{css}</style>
      <div className="wn-page">
        {/* Header */}
        <div className="wn-header">
          <div>
            <h1 className="wn-title">Números WhatsApp</h1>
            <p className="wn-subtitle">Gerencie todos os números conectados — Meta API oficial e Baileys</p>
          </div>
          <button className="wn-btn-add" onClick={() => { setShowModal(true); setErroForm(""); }}>
            + Adicionar número
          </button>
        </div>

        {/* Stats */}
        <div className="wn-stats">
          {[
            { label: "Total", value: total },
            { label: "Conectados", value: conectados, cor: "#4caf82" },
            { label: "Meta API", value: numMeta, cor: "#4a90d9" },
            { label: "Baileys", value: numBaileys, cor: "#c2904d" },
          ].map((s) => (
            <div key={s.label} className="wn-stat">
              <span className="wn-stat-val" style={{ color: s.cor }}>{s.value}</span>
              <span className="wn-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Calculadora de custos Meta */}
        {(() => {
          const PRECOS: Record<string, { usd: number; label: string; cor: string }> = {
            marketing:      { usd: 0.0625, label: "Marketing",      cor: "#e07070" },
            utility:        { usd: 0.0175, label: "Utilitário",     cor: "#4caf82" },
            authentication: { usd: 0.0315, label: "Autenticação",   cor: "#4a90d9" },
          };
          const USD_BRL = 5.55; // taxa aproximada — atualize conforme necessário
          const n = Math.max(0, parseInt(calcContatos) || 0);
          const p = PRECOS[calcCategoria];
          const totalUsd = n * p.usd;
          const totalBrl = totalUsd * USD_BRL;
          return (
            <div className="wn-calc-card">
              <div className="wn-calc-title">Calculadora de custos — Meta WhatsApp</div>
              <div className="wn-calc-desc">Preços por conversa iniciada (Brasil, 2024). 1 USD ≈ R$ {USD_BRL.toFixed(2)}</div>
              <div className="wn-calc-precos">
                {Object.entries(PRECOS).map(([k, v]) => (
                  <button key={k} className={`wn-calc-cat ${calcCategoria === k ? "wn-calc-cat-ativo" : ""}`}
                    style={calcCategoria === k ? { borderColor: v.cor, color: v.cor, background: v.cor + "18" } : {}}
                    onClick={() => setCalcCategoria(k as typeof calcCategoria)}>
                    <span className="wn-calc-cat-label">{v.label}</span>
                    <span className="wn-calc-cat-price">${v.usd.toFixed(4)} / conversa</span>
                  </button>
                ))}
              </div>
              <div className="wn-calc-row">
                <label className="wn-calc-label">Contatos:</label>
                <input className="wn-calc-input" type="number" min="1" value={calcContatos}
                  onChange={e => setCalcContatos(e.target.value)} placeholder="Ex: 1000" />
                <div className="wn-calc-resultado">
                  <span className="wn-calc-usd">${totalUsd.toFixed(2)} USD</span>
                  <span className="wn-calc-brl">≈ R$ {totalBrl.toFixed(2)}</span>
                </div>
              </div>
              <div className="wn-calc-note">* Preços oficiais Meta. Mensagens dentro da janela de 24h (Service) são gratuitas.</div>
            </div>
          );
        })()}

        {/* Lista */}
        {carregando ? (
          <div className="wn-empty">Carregando...</div>
        ) : instancias.length === 0 ? (
          <div className="wn-empty">
            <div className="wn-empty-icon">📱</div>
            <p>Nenhum número configurado ainda.</p>
            <p style={{ color: "#4a3e30", fontSize: 13 }}>Clique em &ldquo;Adicionar número&rdquo; para começar.</p>
          </div>
        ) : (
          <div className="wn-grid">
            {instancias.map((inst) => {
              const st = statusMap[inst.id];
              const eAuto = inst._auto === true;
              return (
                <div key={inst.id} className={`wn-card${inst.principal ? " wn-card-principal" : ""}`}>
                  {/* Topo do card */}
                  <div className="wn-card-top">
                    <div className="wn-card-info">
                      <span className={`wn-badge-tipo wn-badge-${inst.tipo}`}>
                        {inst.tipo === "meta" ? "Meta API" : "Baileys"}
                      </span>
                      {inst.principal && <span className="wn-badge-principal">★ Principal</span>}
                      {eAuto && <span className="wn-badge-auto">auto-detectado</span>}
                    </div>
                    <StatusBadge status={st?.status ?? "carregando"} />
                  </div>

                  {/* Conteúdo */}
                  <div className="wn-card-label">{inst.label}</div>
                  {(inst.phone || st?.detalhe) && (
                    <div className="wn-card-phone">
                      {inst.phone ?? st?.detalhe}
                    </div>
                  )}

                  {/* QR Code para Baileys aguardando */}
                  {inst.tipo === "baileys" && st?.status === "aguardando_qr" && st.qr && (
                    <div className="wn-qr-wrapper">
                      <p className="wn-qr-hint">Escaneie o QR code com o WhatsApp</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={st.qr} alt="QR Code" className="wn-qr-img" />
                      <p className="wn-qr-hint" style={{ color: "#4a3e30" }}>Atualizando automaticamente…</p>
                    </div>
                  )}
                  {inst.tipo === "baileys" && st?.status === "aguardando_qr" && !st.qr && (
                    <div className="wn-qr-placeholder">Aguardando QR…</div>
                  )}

                  {/* Ações */}
                  <div className="wn-card-actions">
                    {!eAuto && !inst.principal && (
                      <button
                        className="wn-btn-sec"
                        onClick={() => definirPrincipal(inst.id)}
                        disabled={tornandoPrincipal === inst.id}
                      >
                        {tornandoPrincipal === inst.id ? "..." : "★ Principal"}
                      </button>
                    )}
                    <button
                      className="wn-btn-status"
                      onClick={() => eAuto ? carregarInstancias() : carregarStatus(inst.id)}
                    >
                      ↻ Atualizar
                    </button>
                    {!eAuto && (
                      <button
                        className="wn-btn-edit"
                        onClick={() => abrirEdicao(inst)}
                      >
                        ✎ Editar
                      </button>
                    )}
                    {!eAuto && (
                      <button
                        className="wn-btn-del"
                        onClick={() => deletar(inst.id)}
                        disabled={deletando === inst.id}
                      >
                        {deletando === inst.id ? "..." : "Remover"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="wn-overlay" onClick={() => { setShowModal(false); setEditando(null); }}>
            <div className="wn-modal" onClick={(e) => e.stopPropagation()}>
              <div className="wn-modal-header">
                <h2 className="wn-modal-title">{editando ? "Editar número" : "Adicionar número"}</h2>
                <button className="wn-modal-close" onClick={() => { setShowModal(false); setEditando(null); }}>✕</button>
              </div>

              {/* Tabs — desativado no modo edição */}
              <div className="wn-tabs">
                {(["meta", "baileys"] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`wn-tab${modalTab === tab ? " wn-tab-active" : ""}`}
                    onClick={() => { if (!editando) { setModalTab(tab); setErroForm(""); } }}
                    style={editando ? { pointerEvents: "none", opacity: .5 } : {}}
                  >
                    {tab === "meta" ? "Meta API Oficial" : "Baileys (local)"}
                  </button>
                ))}
              </div>

              {modalTab === "meta" ? (
                <div className="wn-form">
                  <p className="wn-form-desc">
                    Conecte um número via Meta Cloud API (WhatsApp Business Platform).
                    Requer conta no Meta for Developers e número verificado.
                  </p>
                  <FormField label="Nome / Identificador *" value={formMeta.label}
                    onChange={(v) => setFormMeta((f) => ({ ...f, label: v }))}
                    placeholder="Ex: Número Comercial SP" />
                  <FormField label="Número (exibição)" value={formMeta.phone}
                    onChange={(v) => setFormMeta((f) => ({ ...f, phone: v }))}
                    placeholder="+55 11 99999-9999" />
                  <FormField label="Phone Number ID *" value={formMeta.meta_phone_number_id}
                    onChange={(v) => setFormMeta((f) => ({ ...f, meta_phone_number_id: v }))}
                    placeholder="ID do número no Meta for Developers" />
                  <FormField label="Access Token *" value={formMeta.meta_access_token}
                    onChange={(v) => setFormMeta((f) => ({ ...f, meta_access_token: v }))}
                    placeholder="EAAxx..." type="password" />
                  <FormField label="WABA ID" value={formMeta.meta_waba_id}
                    onChange={(v) => setFormMeta((f) => ({ ...f, meta_waba_id: v }))}
                    placeholder="ID da conta WhatsApp Business (para templates)" />
                  <FormField label="Template padrão" value={formMeta.meta_template_name}
                    onChange={(v) => setFormMeta((f) => ({ ...f, meta_template_name: v }))}
                    placeholder="Nome do template para 1º contato (opcional)" />
                  <FormField label="Idioma do template" value={formMeta.meta_template_language}
                    onChange={(v) => setFormMeta((f) => ({ ...f, meta_template_language: v }))}
                    placeholder="pt_BR" />
                  <div className="wn-form-hint">
                    Onde encontrar: <strong>Meta for Developers</strong> → seu App → WhatsApp → Configuração da API
                  </div>
                </div>
              ) : (
                <div className="wn-form">
                  <p className="wn-form-desc">
                    Conecte um número via Baileys (servidor local). Certifique-se de que o servidor
                    Baileys está em execução e acessível.
                  </p>
                  <FormField label="Nome / Identificador *" value={formBaileys.label}
                    onChange={(v) => setFormBaileys({ label: v })}
                    placeholder="Ex: Número Pessoal, SDR Principal…" />
                  <div className="wn-form-hint">
                    Após salvar, um QR code será exibido para você escanear com o WhatsApp.
                    Certifique-se de que <code>BAILEYS_API_URL</code> aponta para o servidor correto.
                  </div>
                </div>
              )}

              {erroForm && <div className="wn-erro">{erroForm}</div>}

              <div className="wn-modal-footer">
                <button className="wn-btn-cancel" onClick={() => { setShowModal(false); setEditando(null); }}>Cancelar</button>
                <button className="wn-btn-save" onClick={salvarInstancia} disabled={salvando}>
                  {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: StatusConexao }) {
  const map: Record<StatusConexao, { label: string; cor: string; bg: string }> = {
    conectado:     { label: "Conectado",    cor: "#4caf82", bg: "rgba(76,175,130,.12)"  },
    configurado:   { label: "Configurado",  cor: "#4a90d9", bg: "rgba(74,144,217,.12)"  },
    aguardando_qr: { label: "Aguard. QR",   cor: "#c2904d", bg: "rgba(194,144,77,.12)"  },
    erro:          { label: "Erro",         cor: "#e05c5c", bg: "rgba(224,92,92,.12)"   },
    offline:       { label: "Offline",      cor: "#4a3e30", bg: "rgba(74,62,48,.18)"    },
    carregando:    { label: "…",            cor: "#7a6e5e", bg: "rgba(122,110,94,.12)"  },
  };
  const { label, cor, bg } = map[status] ?? map.offline;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
      color: cor, background: bg, border: `1px solid ${cor}30`,
    }}>
      {label}
    </span>
  );
}

function FormField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <label className="wn-field">
      <span className="wn-field-label">{label}</span>
      <input
        className="wn-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}

const css = `
  .wn-page { padding: 28px; max-width: 1100px; margin: 0 auto; }

  /* Header */
  .wn-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
  .wn-title  { font-size:20px; font-weight:700; color:#fff9e6; margin-bottom:4px; }
  .wn-subtitle { font-size:13px; color:#4a3e30; }

  /* Stats */
  .wn-stats { display:flex; gap:12px; margin-bottom:28px; flex-wrap:wrap; }
  .wn-stat  { background:#111009; border:1px solid #2a1f18; border-radius:12px;
               padding:14px 20px; display:flex; flex-direction:column; gap:2px; min-width:90px; }
  .wn-stat-val   { font-size:22px; font-weight:700; color:#fff9e6; line-height:1; }
  .wn-stat-label { font-size:11px; color:#4a3e30; font-weight:500; text-transform:uppercase; letter-spacing:.5px; }

  /* Empty */
  .wn-empty { text-align:center; padding:60px 20px; color:#7a6e5e; font-size:14px; }
  .wn-empty-icon { font-size:40px; margin-bottom:12px; }

  /* Grid */
  .wn-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }

  /* Card */
  .wn-card { background:#111009; border:1px solid #2a1f18; border-radius:14px; padding:20px;
              display:flex; flex-direction:column; gap:12px; transition:border-color .15s; }
  .wn-card:hover { border-color:#3a2e20; }
  .wn-card-principal { border-color:rgba(194,144,77,.35) !important; }

  .wn-card-top   { display:flex; justify-content:space-between; align-items:center; }
  .wn-card-info  { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
  .wn-card-label { font-size:15px; font-weight:600; color:#fff9e6; }
  .wn-card-phone { font-size:13px; color:#7a6e5e; }

  .wn-badge-tipo     { font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
                       text-transform:uppercase; letter-spacing:.5px; }
  .wn-badge-meta     { background:rgba(74,144,217,.12); color:#4a90d9; border:1px solid rgba(74,144,217,.2); }
  .wn-badge-baileys  { background:rgba(194,144,77,.12); color:#c2904d; border:1px solid rgba(194,144,77,.2); }
  .wn-badge-principal{ font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
                       background:rgba(194,144,77,.15); color:#c2904d; border:1px solid rgba(194,144,77,.25); }
  .wn-badge-auto     { font-size:10px; font-weight:500; padding:2px 7px; border-radius:5px;
                       background:rgba(122,110,94,.1); color:#4a3e30; border:1px solid rgba(122,110,94,.15); }

  /* QR */
  .wn-qr-wrapper  { display:flex; flex-direction:column; align-items:center; gap:8px;
                    background:#0e0f09; border:1px solid #2a1f18; border-radius:10px; padding:16px; }
  .wn-qr-hint     { font-size:12px; color:#7a6e5e; text-align:center; }
  .wn-qr-img      { width:180px; height:180px; border-radius:8px; }
  .wn-qr-placeholder { font-size:12px; color:#4a3e30; text-align:center;
                       padding:20px; border:1px dashed #2a1f18; border-radius:8px; }

  /* Actions */
  .wn-card-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
  .wn-btn-sec    { font-size:11px; padding:5px 10px; border-radius:7px; border:1px solid #2a1f18;
                   background:transparent; color:#c2904d; cursor:pointer; font-family:inherit;
                   transition:background .15s; white-space:nowrap; }
  .wn-btn-sec:hover { background:rgba(194,144,77,.08); }
  .wn-btn-status { font-size:11px; padding:5px 10px; border-radius:7px; border:1px solid #2a1f18;
                   background:transparent; color:#7a6e5e; cursor:pointer; font-family:inherit;
                   transition:background .15s; }
  .wn-btn-status:hover { background:rgba(255,255,255,.04); color:#c8b99a; }
  .wn-btn-edit   { font-size:11px; padding:5px 10px; border-radius:7px; border:1px solid #2a1f18;
                   background:transparent; color:#7a6e5e; cursor:pointer; font-family:inherit;
                   transition:background .15s,color .15s; }
  .wn-btn-edit:hover { background:rgba(255,255,255,.04); color:#c8b99a; }
  .wn-btn-del    { font-size:11px; padding:5px 10px; border-radius:7px; border:1px solid transparent;
                   background:transparent; color:#4a3e30; cursor:pointer; font-family:inherit;
                   margin-left:auto; transition:color .15s; }
  .wn-btn-del:hover { color:#e05c5c; }
  .wn-btn-del:disabled, .wn-btn-sec:disabled { opacity:.5; cursor:default; }

  /* Botão Adicionar */
  .wn-btn-add { background:#c2904d; color:#0e0f09; font-size:13px; font-weight:700;
                padding:10px 18px; border-radius:10px; border:none; cursor:pointer;
                transition:background .15s; white-space:nowrap; font-family:inherit; }
  .wn-btn-add:hover { background:#d4a564; }

  /* Modal overlay */
  .wn-overlay { position:fixed; inset:0; background:rgba(0,0,0,.65); z-index:200;
                display:flex; align-items:center; justify-content:center; padding:20px; }
  .wn-modal  { background:#111009; border:1px solid #2a1f18; border-radius:16px;
               width:100%; max-width:520px; max-height:90vh; overflow-y:auto;
               display:flex; flex-direction:column; }

  .wn-modal-header { display:flex; justify-content:space-between; align-items:center;
                     padding:20px 24px 0; }
  .wn-modal-title  { font-size:16px; font-weight:700; color:#fff9e6; }
  .wn-modal-close  { background:none; border:none; color:#4a3e30; font-size:18px;
                     cursor:pointer; padding:4px; transition:color .15s; }
  .wn-modal-close:hover { color:#c8b99a; }

  /* Tabs */
  .wn-tabs { display:flex; gap:0; border-bottom:1px solid #2a1f18; margin:16px 24px 0; }
  .wn-tab  { flex:1; background:none; border:none; border-bottom:2px solid transparent;
             padding:10px; font-size:13px; font-weight:500; color:#4a3e30;
             cursor:pointer; font-family:inherit; transition:color .15s,border-color .15s;
             margin-bottom:-1px; }
  .wn-tab:hover { color:#7a6e5e; }
  .wn-tab-active { color:#c2904d !important; border-bottom-color:#c2904d !important; }

  /* Form */
  .wn-form      { padding:20px 24px; display:flex; flex-direction:column; gap:14px; }
  .wn-form-desc { font-size:13px; color:#7a6e5e; line-height:1.5; }
  .wn-form-hint { font-size:12px; color:#4a3e30; line-height:1.5; }
  .wn-form-hint code { background:#1a170f; padding:1px 5px; border-radius:4px; color:#c2904d; }
  .wn-form-hint strong { color:#7a6e5e; }
  .wn-field       { display:flex; flex-direction:column; gap:5px; }
  .wn-field-label { font-size:12px; font-weight:600; color:#7a6e5e; text-transform:uppercase; letter-spacing:.4px; }
  .wn-input { background:#0e0f09; border:1px solid #2a1f18; border-radius:8px;
              padding:9px 12px; font-size:13px; color:#fff9e6; font-family:inherit;
              outline:none; transition:border-color .15s; }
  .wn-input:focus { border-color:rgba(194,144,77,.4); }
  .wn-input::placeholder { color:#2a1f18; }

  /* Erro */
  .wn-erro { margin:0 24px; padding:10px 14px; border-radius:8px;
             background:rgba(224,92,92,.1); border:1px solid rgba(224,92,92,.2);
             color:#e05c5c; font-size:13px; }

  /* Footer modal */
  .wn-modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 24px; border-top:1px solid #1a170f; }
  .wn-btn-cancel { background:transparent; border:1px solid #2a1f18; color:#7a6e5e;
                   padding:9px 16px; border-radius:9px; font-size:13px; cursor:pointer;
                   font-family:inherit; transition:background .15s; }
  .wn-btn-cancel:hover { background:rgba(255,255,255,.04); }
  .wn-btn-save   { background:#c2904d; color:#0e0f09; font-weight:700;
                   padding:9px 20px; border-radius:9px; border:none;
                   font-size:13px; cursor:pointer; font-family:inherit; transition:background .15s; }
  .wn-btn-save:hover   { background:#d4a564; }
  .wn-btn-save:disabled { opacity:.6; cursor:default; }

  /* Calculadora */
  .wn-calc-card { background:#111009; border:1px solid #2a1f18; border-radius:14px;
                  padding:20px 24px; margin-bottom:28px; display:flex; flex-direction:column; gap:12px; }
  .wn-calc-title { font-size:14px; font-weight:700; color:#fff9e6; }
  .wn-calc-desc  { font-size:12px; color:#4a3e30; }
  .wn-calc-precos { display:flex; gap:8px; flex-wrap:wrap; }
  .wn-calc-cat   { background:transparent; border:1px solid #2a1f18; border-radius:9px;
                   padding:8px 14px; cursor:pointer; font-family:inherit; display:flex;
                   flex-direction:column; gap:2px; transition:border-color .15s,background .15s; }
  .wn-calc-cat:hover { border-color:#3a2e20; }
  .wn-calc-cat-label { font-size:12px; font-weight:600; color:#c8b99a; }
  .wn-calc-cat-price { font-size:11px; color:#7a6e5e; }
  .wn-calc-cat-ativo .wn-calc-cat-label { color:inherit; }
  .wn-calc-row   { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .wn-calc-label { font-size:12px; color:#7a6e5e; font-weight:600; white-space:nowrap; }
  .wn-calc-input { background:#0e0f09; border:1px solid #2a1f18; border-radius:8px;
                   padding:7px 12px; font-size:13px; color:#fff9e6; font-family:inherit;
                   outline:none; width:120px; transition:border-color .15s; }
  .wn-calc-input:focus { border-color:rgba(194,144,77,.4); }
  .wn-calc-resultado { display:flex; gap:10px; align-items:baseline; }
  .wn-calc-usd  { font-size:16px; font-weight:700; color:#fff9e6; }
  .wn-calc-brl  { font-size:13px; color:#c2904d; font-weight:600; }
  .wn-calc-note { font-size:11px; color:#2a1f18; }

  @media(max-width:600px) {
    .wn-page { padding:16px; }
    .wn-header { flex-direction:column; }
    .wn-grid { grid-template-columns:1fr; }
  }
`;

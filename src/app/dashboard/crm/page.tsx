"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── tipos ────────────────────────────────────────────────────────────────────
type Conversa = {
  id: string;
  nome: string;
  whatsapp: string;
  etiqueta: string;
  status_lead: string;
  ultima_mensagem: string;
  ultima_role: string;
  ultima_atividade: string;
};

type Mensagem = {
  id: string;
  role: "user" | "assistant";
  mensagem: string;
  criado_em: string;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function tempoRelativo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function horaMsg(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dataMsg(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ETIQUETAS: { valor: string; label: string; cor: string }[] = [
  { valor: "ia_atendendo", label: "IA atendendo", cor: "#6acca0" },
  { valor: "humano_atendendo", label: "Humano", cor: "#c2904d" },
  { valor: "aguardando_agendamento", label: "Aguardando agendamento", cor: "#7ab0e0" },
  { valor: "agendado", label: "Agendado", cor: "#a07ae0" },
  { valor: "fechado", label: "Fechado", cor: "#e07070" },
];

function etiquetaInfo(val: string) {
  return ETIQUETAS.find(e => e.valor === val) ?? { valor: val, label: val, cor: "#7a6e5e" };
}

const FILTROS = [
  { valor: "", label: "Todas" },
  { valor: "ia_atendendo", label: "IA" },
  { valor: "humano_atendendo", label: "Humano" },
  { valor: "aguardando_agendamento", label: "Agendamento" },
];

// ─── componente principal ─────────────────────────────────────────────────────
export default function CRMPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [leadSelecionado, setLeadSelecionado] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");
  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [vistaChat, setVistaChat] = useState(false); // mobile
  const [trocandoEtiqueta, setTrocandoEtiqueta] = useState(false);
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── carrega lista de conversas ──────────────────────────────────────────────
  const carregarLista = useCallback(async (etiqueta = filtroEtiqueta, q = busca) => {
    const params = new URLSearchParams();
    if (etiqueta) params.set("etiqueta", etiqueta);
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/crm/conversas?${params}`).then(r => r.json()).catch(() => []);
    setConversas(Array.isArray(res) ? res : []);
    setLoadingLista(false);
  }, [filtroEtiqueta, busca]);

  useEffect(() => { carregarLista(); }, [carregarLista]);

  // ── carrega mensagens do lead selecionado ───────────────────────────────────
  const carregarMensagens = useCallback(async (leadId: string) => {
    setLoadingMsgs(true);
    const res = await fetch(`/api/admin/crm/conversas/${leadId}`).then(r => r.json()).catch(() => []);
    setMensagens(Array.isArray(res) ? res : []);
    setLoadingMsgs(false);
  }, []);

  // ── Supabase Realtime ───────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("crm-conversas")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversas" }, payload => {
        const nova = payload.new as { lead_id: string; id: string; role: string; mensagem: string; criado_em: string };
        // Atualiza última mensagem na lista
        setConversas(prev => {
          const idx = prev.findIndex(c => c.id === nova.lead_id);
          if (idx === -1) {
            // Lead novo com conversa: recarrega a lista
            carregarLista();
            return prev;
          }
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            ultima_mensagem: nova.mensagem,
            ultima_role: nova.role,
            ultima_atividade: nova.criado_em,
          };
          // Move para o topo
          const [item] = updated.splice(idx, 1);
          return [item, ...updated];
        });
        // Se a mensagem é do lead selecionado, adiciona no chat
        setLeadSelecionado(prev => {
          if (prev?.id === nova.lead_id) {
            setMensagens(m => [...m, { id: nova.id, role: nova.role as "user" | "assistant", mensagem: nova.mensagem, criado_em: nova.criado_em }]);
          }
          return prev;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [carregarLista]);

  // ── scroll ao fundo quando mensagens mudam ──────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // ── seleciona lead ──────────────────────────────────────────────────────────
  function selecionarLead(conv: Conversa) {
    setLeadSelecionado(conv);
    carregarMensagens(conv.id);
    setVistaChat(true);
    setErroEnvio("");
    setMostrarEtiquetas(false);
  }

  // ── envia mensagem ──────────────────────────────────────────────────────────
  async function enviar() {
    if (!leadSelecionado || !texto.trim() || enviando) return;
    setEnviando(true);
    setErroEnvio("");
    const form = new FormData();
    form.append("lead_id", leadSelecionado.id);
    form.append("texto", texto.trim());
    const res = await fetch("/api/admin/enviar-mensagem", { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json();
      setErroEnvio(data.error || "Erro ao enviar");
    } else {
      setTexto("");
      // Atualiza etiqueta local para humano_atendendo
      setLeadSelecionado(prev => prev ? { ...prev, etiqueta: "humano_atendendo" } : prev);
      setConversas(prev => prev.map(c => c.id === leadSelecionado.id ? { ...c, etiqueta: "humano_atendendo" } : c));
    }
    setEnviando(false);
    inputRef.current?.focus();
  }

  // ── troca etiqueta ──────────────────────────────────────────────────────────
  async function trocarEtiqueta(novaEtiqueta: string) {
    if (!leadSelecionado) return;
    setTrocandoEtiqueta(true);
    setMostrarEtiquetas(false);
    const res = await fetch(`/api/admin/leads/${leadSelecionado.id}/etiqueta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etiqueta: novaEtiqueta }),
    });
    if (res.ok) {
      setLeadSelecionado(prev => prev ? { ...prev, etiqueta: novaEtiqueta } : prev);
      setConversas(prev => prev.map(c => c.id === leadSelecionado.id ? { ...c, etiqueta: novaEtiqueta } : c));
    }
    setTrocandoEtiqueta(false);
  }

  // ── agrupa mensagens por data ────────────────────────────────────────────────
  function mensagensComSeparador() {
    const grupos: Array<{ tipo: "data"; data: string } | { tipo: "msg"; msg: Mensagem }> = [];
    let dataAtual = "";
    for (const msg of mensagens) {
      const d = dataMsg(msg.criado_em);
      if (d !== dataAtual) { grupos.push({ tipo: "data", data: d }); dataAtual = d; }
      grupos.push({ tipo: "msg", msg });
    }
    return grupos;
  }

  const listaFiltrada = conversas.filter(c => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return c.nome?.toLowerCase().includes(b) || c.whatsapp?.includes(b);
  });

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="crm-root">

        {/* ── Sidebar esquerda: lista de conversas ── */}
        <aside className={`crm-sidebar ${vistaChat ? "crm-sidebar-hidden" : ""}`}>
          <div className="crm-sidebar-header">
            <h1 className="crm-title">WhatsApp CRM</h1>
            <div className="crm-search-wrap">
              <input
                className="crm-search"
                placeholder="Buscar por nome ou número…"
                value={busca}
                onChange={e => { setBusca(e.target.value); carregarLista(filtroEtiqueta, e.target.value); }}
              />
            </div>
            <div className="crm-filtros">
              {FILTROS.map(f => (
                <button
                  key={f.valor}
                  className={`crm-filtro-btn ${filtroEtiqueta === f.valor ? "filtro-on" : ""}`}
                  onClick={() => { setFiltroEtiqueta(f.valor); carregarLista(f.valor, busca); }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="crm-lista">
            {loadingLista ? (
              <div className="crm-vazio">Carregando…</div>
            ) : listaFiltrada.length === 0 ? (
              <div className="crm-vazio">Nenhuma conversa encontrada.</div>
            ) : listaFiltrada.map(conv => {
              const et = etiquetaInfo(conv.etiqueta);
              const ativo = leadSelecionado?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  className={`crm-item ${ativo ? "crm-item-ativo" : ""}`}
                  onClick={() => selecionarLead(conv)}
                >
                  <div className="crm-avatar">
                    {(conv.nome || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="crm-item-body">
                    <div className="crm-item-top">
                      <span className="crm-item-nome">{conv.nome || conv.whatsapp}</span>
                      <span className="crm-item-hora">{tempoRelativo(conv.ultima_atividade)}</span>
                    </div>
                    <div className="crm-item-preview">
                      {conv.ultima_role === "assistant" && <span className="crm-item-tick">✓ </span>}
                      <span>{conv.ultima_mensagem?.slice(0, 60)}{conv.ultima_mensagem?.length > 60 ? "…" : ""}</span>
                    </div>
                    <div className="crm-item-bottom">
                      <span className="crm-etiqueta-badge" style={{ color: et.cor, borderColor: et.cor + "44", background: et.cor + "15" }}>
                        {et.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Painel direito: chat ── */}
        <main className={`crm-chat ${!vistaChat ? "crm-chat-hidden" : ""}`}>
          {!leadSelecionado ? (
            <div className="crm-chat-vazio">
              <div className="crm-chat-vazio-icon">◉</div>
              <p>Selecione uma conversa para começar</p>
            </div>
          ) : (
            <>
              {/* Header do chat */}
              <div className="crm-chat-header">
                <button className="crm-back-btn" onClick={() => setVistaChat(false)}>← Conversas</button>
                <div className="crm-chat-lead-info">
                  <div className="crm-chat-avatar">{(leadSelecionado.nome || "?").charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="crm-chat-nome">{leadSelecionado.nome}</div>
                    <div className="crm-chat-fone">{leadSelecionado.whatsapp}</div>
                  </div>
                </div>
                <div className="crm-chat-actions">
                  {/* Botão de transferência rápida */}
                  {leadSelecionado.etiqueta === "ia_atendendo" ? (
                    <button
                      className="crm-assumir-btn"
                      onClick={() => trocarEtiqueta("humano_atendendo")}
                      disabled={trocandoEtiqueta}
                      title="Assumir atendimento — IA para de responder"
                    >
                      Assumir
                    </button>
                  ) : leadSelecionado.etiqueta === "humano_atendendo" ? (
                    <button
                      className="crm-devolver-btn"
                      onClick={() => trocarEtiqueta("ia_atendendo")}
                      disabled={trocandoEtiqueta}
                      title="Devolver para IA"
                    >
                      Devolver à IA
                    </button>
                  ) : null}

                  {/* Etiqueta com dropdown */}
                  <div className="crm-etiqueta-wrap">
                    <button
                      className="crm-etiqueta-select"
                      onClick={() => setMostrarEtiquetas(v => !v)}
                      style={{ color: etiquetaInfo(leadSelecionado.etiqueta).cor, borderColor: etiquetaInfo(leadSelecionado.etiqueta).cor + "44", background: etiquetaInfo(leadSelecionado.etiqueta).cor + "15" }}
                    >
                      {etiquetaInfo(leadSelecionado.etiqueta).label} ▾
                    </button>
                    {mostrarEtiquetas && (
                      <div className="crm-etiqueta-dropdown">
                        {ETIQUETAS.map(et => (
                          <button
                            key={et.valor}
                            className={`crm-etiqueta-opt ${leadSelecionado.etiqueta === et.valor ? "et-ativo" : ""}`}
                            style={{ "--et-cor": et.cor } as React.CSSProperties}
                            onClick={() => trocarEtiqueta(et.valor)}
                          >
                            <span className="et-dot" style={{ background: et.cor }} />
                            {et.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              <div className="crm-msgs" onClick={() => setMostrarEtiquetas(false)}>
                {loadingMsgs ? (
                  <div className="crm-msgs-loading">Carregando mensagens…</div>
                ) : mensagens.length === 0 ? (
                  <div className="crm-msgs-vazio">Nenhuma mensagem ainda.</div>
                ) : (
                  mensagensComSeparador().map((item, i) => {
                    if (item.tipo === "data") {
                      return <div key={`d-${i}`} className="crm-data-sep"><span>{item.data}</span></div>;
                    }
                    const msg = item.msg;
                    const isBot = msg.role === "assistant";
                    return (
                      <div key={msg.id} className={`crm-bubble-wrap ${isBot ? "wrap-bot" : "wrap-user"}`}>
                        <div className={`crm-bubble ${isBot ? "bubble-bot" : "bubble-user"}`}>
                          <div className="crm-bubble-text">{msg.mensagem}</div>
                          <div className="crm-bubble-hora">{horaMsg(msg.criado_em)}{isBot && " ✓"}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input de resposta */}
              <div className="crm-input-area">
                {erroEnvio && <div className="crm-envio-erro">{erroEnvio}</div>}
                <div className="crm-input-row">
                  <textarea
                    ref={inputRef}
                    className="crm-textarea"
                    placeholder="Digite uma mensagem…"
                    value={texto}
                    rows={1}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  />
                  <button
                    className="crm-send-btn"
                    onClick={enviar}
                    disabled={enviando || !texto.trim()}
                  >
                    {enviando ? "…" : "➤"}
                  </button>
                </div>
                <div className="crm-input-hint">Enter para enviar · Shift+Enter para nova linha</div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

// ─── estilos ──────────────────────────────────────────────────────────────────
const css = `
  .crm-root{display:flex;height:calc(100vh - 60px);overflow:hidden;background:#0e0f09;}

  /* ── sidebar ── */
  .crm-sidebar{width:320px;flex-shrink:0;background:#111009;border-right:1px solid #2a1f18;display:flex;flex-direction:column;overflow:hidden;}
  .crm-sidebar-header{padding:20px 16px 12px;border-bottom:1px solid #2a1f18;display:flex;flex-direction:column;gap:10px;}
  .crm-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#fff9e6;}
  .crm-search{width:100%;background:#0e0f09;border:1px solid #2a1f18;border-radius:8px;padding:9px 12px;font-size:13px;color:#fff9e6;font-family:inherit;outline:none;transition:border-color .2s;}
  .crm-search:focus{border-color:rgba(194,144,77,.4);}
  .crm-search::placeholder{color:#4a3e30;}
  .crm-filtros{display:flex;gap:6px;flex-wrap:wrap;}
  .crm-filtro-btn{background:none;border:1px solid #2a1f18;border-radius:6px;padding:5px 11px;font-size:11px;font-weight:600;color:#4a3e30;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .crm-filtro-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .filtro-on{background:rgba(194,144,77,.1)!important;border-color:rgba(194,144,77,.3)!important;color:#c2904d!important;}
  .crm-lista{flex:1;overflow-y:auto;}
  .crm-vazio{padding:32px 20px;font-size:13px;color:#4a3e30;text-align:center;}
  .crm-item{width:100%;background:none;border:none;border-bottom:1px solid #1a1410;padding:14px 16px;display:flex;align-items:flex-start;gap:12px;cursor:pointer;font-family:inherit;transition:background .1s;text-align:left;}
  .crm-item:hover{background:rgba(255,255,255,.025);}
  .crm-item-ativo{background:rgba(194,144,77,.07)!important;border-left:2px solid #c2904d;}
  .crm-avatar{width:40px;height:40px;border-radius:50%;background:rgba(194,144,77,.15);color:#c2904d;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Cormorant Garamond',serif;}
  .crm-item-body{flex:1;min-width:0;}
  .crm-item-top{display:flex;justify-content:space-between;align-items:baseline;gap:4px;margin-bottom:3px;}
  .crm-item-nome{font-size:14px;font-weight:600;color:#fff9e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .crm-item-hora{font-size:11px;color:#4a3e30;flex-shrink:0;}
  .crm-item-preview{font-size:12px;color:#7a6e5e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px;line-height:1.4;}
  .crm-item-tick{color:#c2904d;font-size:11px;}
  .crm-item-bottom{display:flex;gap:6px;}
  .crm-etiqueta-badge{font-size:10px;font-weight:600;letter-spacing:.3px;padding:2px 7px;border-radius:99px;border:1px solid;white-space:nowrap;}

  /* ── chat ── */
  .crm-chat{flex:1;display:flex;flex-direction:column;min-width:0;background:#0e0f09;}
  .crm-chat-vazio{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#4a3e30;}
  .crm-chat-vazio-icon{font-size:36px;opacity:.3;}
  .crm-chat-vazio p{font-size:14px;}

  /* chat header */
  .crm-chat-header{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid #2a1f18;background:#111009;flex-shrink:0;}
  .crm-back-btn{display:none;background:none;border:none;color:#c2904d;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;padding:0;white-space:nowrap;}
  .crm-chat-lead-info{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
  .crm-chat-avatar{width:36px;height:36px;border-radius:50%;background:rgba(194,144,77,.15);color:#c2904d;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Cormorant Garamond',serif;}
  .crm-chat-nome{font-size:15px;font-weight:600;color:#fff9e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .crm-chat-fone{font-size:11px;color:#4a3e30;font-family:monospace;}
  .crm-chat-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
  .crm-assumir-btn{background:rgba(106,204,160,.1);border:1px solid rgba(106,204,160,.3);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;color:#6acca0;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .crm-assumir-btn:hover:not(:disabled){background:rgba(106,204,160,.2);}
  .crm-assumir-btn:disabled{opacity:.5;}
  .crm-devolver-btn{background:rgba(194,144,77,.1);border:1px solid rgba(194,144,77,.3);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;color:#c2904d;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .crm-devolver-btn:hover:not(:disabled){background:rgba(194,144,77,.2);}
  .crm-devolver-btn:disabled{opacity:.5;}

  /* etiqueta dropdown */
  .crm-etiqueta-wrap{position:relative;}
  .crm-etiqueta-select{font-size:11px;font-weight:600;padding:6px 10px;border-radius:99px;border:1px solid;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .crm-etiqueta-dropdown{position:absolute;right:0;top:calc(100% + 6px);background:#1a1410;border:1px solid #2a1f18;border-radius:10px;min-width:200px;z-index:50;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.4);}
  .crm-etiqueta-opt{width:100%;background:none;border:none;padding:10px 14px;font-size:13px;color:#7a6e5e;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:8px;transition:background .1s;text-align:left;}
  .crm-etiqueta-opt:hover{background:rgba(255,255,255,.04);color:#fff9e6;}
  .et-ativo{color:#fff9e6!important;background:rgba(255,255,255,.05)!important;}
  .et-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}

  /* mensagens */
  .crm-msgs{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:2px;}
  .crm-msgs-loading,.crm-msgs-vazio{color:#4a3e30;font-size:13px;text-align:center;padding:24px;}
  .crm-data-sep{display:flex;align-items:center;justify-content:center;margin:12px 0;}
  .crm-data-sep span{font-size:11px;color:#4a3e30;background:#1a1410;padding:3px 12px;border-radius:99px;border:1px solid #2a1f18;}
  .crm-bubble-wrap{display:flex;margin-bottom:2px;}
  .wrap-bot{justify-content:flex-start;}
  .wrap-user{justify-content:flex-end;}
  .crm-bubble{max-width:72%;padding:10px 14px;border-radius:14px;position:relative;}
  .bubble-bot{background:#1e1a12;border:1px solid #2a1f18;border-bottom-left-radius:4px;}
  .bubble-user{background:rgba(194,144,77,.12);border:1px solid rgba(194,144,77,.2);border-bottom-right-radius:4px;}
  .crm-bubble-text{font-size:14px;color:#fff9e6;line-height:1.55;white-space:pre-wrap;word-break:break-word;}
  .crm-bubble-hora{font-size:10px;color:#4a3e30;margin-top:4px;text-align:right;}
  .bubble-user .crm-bubble-hora{color:rgba(194,144,77,.5);}

  /* input */
  .crm-input-area{padding:12px 16px;border-top:1px solid #2a1f18;background:#111009;flex-shrink:0;}
  .crm-envio-erro{font-size:12px;color:#e07070;margin-bottom:8px;}
  .crm-input-row{display:flex;gap:10px;align-items:flex-end;}
  .crm-textarea{flex:1;background:#0e0f09;border:1px solid #2a1f18;border-radius:12px;padding:10px 14px;font-size:14px;color:#fff9e6;font-family:inherit;line-height:1.5;resize:none;outline:none;transition:border-color .2s;max-height:140px;overflow-y:auto;}
  .crm-textarea:focus{border-color:rgba(194,144,77,.4);}
  .crm-textarea::placeholder{color:#4a3e30;}
  .crm-send-btn{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#c2904d,#d4a055);border:none;color:#0e0f09;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}
  .crm-send-btn:hover:not(:disabled){filter:brightness(1.1);}
  .crm-send-btn:disabled{opacity:.4;cursor:not-allowed;}
  .crm-input-hint{font-size:11px;color:#2a1f18;margin-top:6px;}

  /* ── mobile ── */
  @media(max-width:768px){
    .crm-root{flex-direction:column;height:auto;min-height:calc(100vh - 60px);}
    .crm-sidebar{width:100%;border-right:none;border-bottom:1px solid #2a1f18;height:auto;max-height:calc(100vh - 60px);}
    .crm-sidebar-hidden{display:none;}
    .crm-chat{height:calc(100vh - 60px);}
    .crm-chat-hidden{display:none;}
    .crm-back-btn{display:block;}
    .crm-chat-nome{font-size:14px;}
    .crm-assumir-btn,.crm-devolver-btn{padding:6px 10px;font-size:11px;}
    .crm-bubble{max-width:88%;}
    .crm-msgs{padding:12px 10px;}
  }
`;

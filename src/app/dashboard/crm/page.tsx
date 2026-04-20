"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── tipos ────────────────────────────────────────────────────────────────────
type Conversa = { id: string; nome: string; whatsapp: string; etiqueta: string; status_lead: string; ultima_mensagem: string; ultima_role: string; ultima_atividade: string };
type Mensagem = { id: string; role: "user" | "assistant"; mensagem: string; criado_em: string };
type Template = { id: string; nome: string; conteudo: string; criado_em: string };
type Agendamento = { id: string; lead_id: string; payload: { texto?: string }; agendado_para: string; status: string; criado_em: string };

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
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
}
function dataMsg(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatSeg(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function tipoMidiaLabel(mime: string): string {
  if (mime.startsWith("image/")) return "Imagem";
  if (mime.startsWith("video/")) return "Vídeo";
  if (mime.startsWith("audio/")) return "Áudio";
  return "Documento";
}

const ETIQUETAS = [
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
  // lista & chat
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
  const [vistaChat, setVistaChat] = useState(false);
  const [trocandoEtiqueta, setTrocandoEtiqueta] = useState(false);
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(false);

  // arquivo/mídia
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // gravação de áudio
  const [gravando, setGravando] = useState(false);
  const [tempoGrav, setTempoGrav] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const gravTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mostrarTemplates, setMostrarTemplates] = useState(false);
  const [mostrarSalvarTpl, setMostrarSalvarTpl] = useState(false);
  const [novoTplNome, setNovoTplNome] = useState("");
  const [salvandoTpl, setSalvandoTpl] = useState(false);

  // agendamento
  const [mostrarAgendar, setMostrarAgendar] = useState(false);
  const [agendarTexto, setAgendarTexto] = useState("");
  const [agendarData, setAgendarData] = useState("");
  const [agendarHora, setAgendarHora] = useState("");
  const [salvandoAgend, setSalvandoAgend] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [mostrarAgendados, setMostrarAgendados] = useState(false);

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

  // ── carrega templates ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/crm/templates").then(r => r.json()).then(d => { if (Array.isArray(d)) setTemplates(d); }).catch(() => {});
  }, []);

  // ── carrega agendamentos do lead selecionado ────────────────────────────────
  const carregarAgendamentos = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/admin/crm/agendar?lead_id=${leadId}`).then(r => r.json()).catch(() => []);
    setAgendamentos(Array.isArray(res) ? res.filter((a: Agendamento) => a.status === "pendente") : []);
  }, []);

  // ── Supabase Realtime ───────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const chConversas = supabase.channel("crm-conversas").on("postgres_changes", { event: "INSERT", schema: "public", table: "conversas" }, payload => {
      const nova = payload.new as { lead_id: string; id: string; role: string; mensagem: string; criado_em: string };
      setConversas(prev => {
        const idx = prev.findIndex(c => c.id === nova.lead_id);
        if (idx === -1) { carregarLista(); return prev; }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ultima_mensagem: nova.mensagem, ultima_role: nova.role, ultima_atividade: nova.criado_em };
        const [item] = updated.splice(idx, 1);
        return [item, ...updated];
      });
      setLeadSelecionado(prev => {
        if (prev?.id === nova.lead_id) {
          setMensagens(m => [...m, { id: nova.id, role: nova.role as "user" | "assistant", mensagem: nova.mensagem, criado_em: nova.criado_em }]);
        }
        return prev;
      });
    }).subscribe();
    const chLeads = supabase.channel("crm-leads").on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, payload => {
      const a = payload.new as { id: string; etiqueta: string; status_lead: string };
      setConversas(prev => prev.map(c => c.id === a.id ? { ...c, etiqueta: a.etiqueta, status_lead: a.status_lead } : c));
      setLeadSelecionado(prev => prev?.id === a.id ? { ...prev, etiqueta: a.etiqueta, status_lead: a.status_lead } : prev);
    }).subscribe();
    return () => { supabase.removeChannel(chConversas); supabase.removeChannel(chLeads); };
  }, [carregarLista]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens]);

  // ── seleciona lead ──────────────────────────────────────────────────────────
  function selecionarLead(conv: Conversa) {
    setLeadSelecionado(conv);
    carregarMensagens(conv.id);
    carregarAgendamentos(conv.id);
    setVistaChat(true);
    setErroEnvio("");
    setMostrarEtiquetas(false);
    setArquivo(null);
    setCaption("");
    setMostrarAgendar(false);
    setMostrarAgendados(false);
    setMostrarTemplates(false);
  }

  // ── envia mensagem (texto ou arquivo) ───────────────────────────────────────
  async function enviar() {
    if (!leadSelecionado || enviando) return;
    if (!texto.trim() && !arquivo) return;
    setEnviando(true);
    setErroEnvio("");
    const form = new FormData();
    form.append("lead_id", leadSelecionado.id);
    if (arquivo) {
      form.append("file", arquivo);
      if (caption.trim()) form.append("caption", caption.trim());
    } else {
      form.append("texto", texto.trim());
    }
    const res = await fetch("/api/admin/enviar-mensagem", { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json();
      setErroEnvio(data.error || "Erro ao enviar");
    } else {
      setTexto("");
      setArquivo(null);
      setCaption("");
      setLeadSelecionado(prev => prev ? { ...prev, etiqueta: "humano_atendendo" } : prev);
      setConversas(prev => prev.map(c => c.id === leadSelecionado.id ? { ...c, etiqueta: "humano_atendendo" } : c));
    }
    setEnviando(false);
    inputRef.current?.focus();
  }

  // ── gravação de áudio ───────────────────────────────────────────────────────
  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Priorizar formatos aceitos pela Meta API; webm é fallback (vai via Baileys)
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a.40.2") ? "audio/mp4;codecs=mp4a.40.2"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : "audio/webm;codecs=opus";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : "mp4";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const file = new File([blob], `audio-gravado.${ext}`, { type: mimeType });
        setArquivo(file);
        setGravando(false);
        setTempoGrav(0);
        if (gravTimerRef.current) clearInterval(gravTimerRef.current);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
      setTempoGrav(0);
      gravTimerRef.current = setInterval(() => setTempoGrav(s => s + 1), 1000);
    } catch {
      setErroEnvio("Permissão de microfone negada.");
    }
  }
  function pararGravacao() { mediaRecorderRef.current?.stop(); }
  function cancelarGravacao() {
    mediaRecorderRef.current?.stop();
    // limpa o arquivo que seria setado no onstop
    setTimeout(() => { setArquivo(null); }, 100);
  }

  // ── troca etiqueta ──────────────────────────────────────────────────────────
  async function trocarEtiqueta(novaEtiqueta: string) {
    if (!leadSelecionado) return;
    setTrocandoEtiqueta(true);
    setMostrarEtiquetas(false);
    const res = await fetch(`/api/admin/leads/${leadSelecionado.id}/etiqueta`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ etiqueta: novaEtiqueta }) });
    if (res.ok) {
      setLeadSelecionado(prev => prev ? { ...prev, etiqueta: novaEtiqueta } : prev);
      setConversas(prev => prev.map(c => c.id === leadSelecionado.id ? { ...c, etiqueta: novaEtiqueta } : c));
    }
    setTrocandoEtiqueta(false);
  }

  // ── templates ───────────────────────────────────────────────────────────────
  function usarTemplate(tpl: Template) {
    setTexto(tpl.conteudo);
    setMostrarTemplates(false);
    inputRef.current?.focus();
  }
  async function salvarTemplate() {
    if (!novoTplNome.trim() || !texto.trim()) return;
    setSalvandoTpl(true);
    const res = await fetch("/api/admin/crm/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: novoTplNome.trim(), conteudo: texto.trim() }) });
    if (res.ok) {
      const novo = await res.json();
      setTemplates(prev => [novo, ...prev]);
      setNovoTplNome("");
      setMostrarSalvarTpl(false);
    }
    setSalvandoTpl(false);
  }
  async function deletarTemplate(id: string) {
    await fetch(`/api/admin/crm/templates/${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  // ── agendamento ─────────────────────────────────────────────────────────────
  async function criarAgendamento() {
    if (!leadSelecionado || !agendarTexto.trim() || !agendarData || !agendarHora) return;
    setSalvandoAgend(true);
    const agendado_para = `${agendarData}T${agendarHora}:00`;
    const res = await fetch("/api/admin/crm/agendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: leadSelecionado.id, texto: agendarTexto.trim(), agendado_para }) });
    if (res.ok) {
      const novo = await res.json();
      setAgendamentos(prev => [...prev, novo]);
      setAgendarTexto("");
      setAgendarData("");
      setAgendarHora("");
      setMostrarAgendar(false);
    }
    setSalvandoAgend(false);
  }
  async function cancelarAgendamento(id: string) {
    await fetch("/api/admin/crm/agendar", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setAgendamentos(prev => prev.filter(a => a.id !== id));
  }

  // ── agrupa mensagens por data ───────────────────────────────────────────────
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

        {/* ── Sidebar ── */}
        <aside className={`crm-sidebar ${vistaChat ? "crm-sidebar-hidden" : ""}`}>
          <div className="crm-sidebar-header">
            <h1 className="crm-title">WhatsApp CRM</h1>
            <input className="crm-search" placeholder="Buscar por nome ou número…" value={busca} onChange={e => { setBusca(e.target.value); carregarLista(filtroEtiqueta, e.target.value); }} />
            <div className="crm-filtros">
              {FILTROS.map(f => (
                <button key={f.valor} className={`crm-filtro-btn ${filtroEtiqueta === f.valor ? "filtro-on" : ""}`} onClick={() => { setFiltroEtiqueta(f.valor); carregarLista(f.valor, busca); }}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="crm-lista">
            {loadingLista ? <div className="crm-vazio">Carregando…</div>
            : listaFiltrada.length === 0 ? <div className="crm-vazio">Nenhuma conversa encontrada.</div>
            : listaFiltrada.map(conv => {
              const et = etiquetaInfo(conv.etiqueta);
              return (
                <button key={conv.id} className={`crm-item ${leadSelecionado?.id === conv.id ? "crm-item-ativo" : ""}`} onClick={() => selecionarLead(conv)}>
                  <div className="crm-avatar">{(conv.nome || "?").charAt(0).toUpperCase()}</div>
                  <div className="crm-item-body">
                    <div className="crm-item-top">
                      <span className="crm-item-nome">{conv.nome || conv.whatsapp}</span>
                      <span className="crm-item-hora">{tempoRelativo(conv.ultima_atividade)}</span>
                    </div>
                    <div className="crm-item-preview">{conv.ultima_role === "assistant" && <span className="crm-item-tick">✓ </span>}{conv.ultima_mensagem?.slice(0, 60)}{conv.ultima_mensagem?.length > 60 ? "…" : ""}</div>
                    <div className="crm-item-bottom">
                      <span className="crm-etiqueta-badge" style={{ color: et.cor, borderColor: et.cor + "44", background: et.cor + "15" }}>{et.label}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Chat ── */}
        <main className={`crm-chat ${!vistaChat ? "crm-chat-hidden" : ""}`}>
          {!leadSelecionado ? (
            <div className="crm-chat-vazio"><div className="crm-chat-vazio-icon">◉</div><p>Selecione uma conversa para começar</p></div>
          ) : (
            <>
              {/* Header */}
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
                  {leadSelecionado.etiqueta === "ia_atendendo" ? (
                    <button className="crm-assumir-btn" onClick={() => trocarEtiqueta("humano_atendendo")} disabled={trocandoEtiqueta}>Assumir</button>
                  ) : leadSelecionado.etiqueta === "humano_atendendo" ? (
                    <button className="crm-devolver-btn" onClick={() => trocarEtiqueta("ia_atendendo")} disabled={trocandoEtiqueta}>Devolver à IA</button>
                  ) : null}

                  {/* Agendados badge */}
                  {agendamentos.length > 0 && (
                    <button className="crm-agendados-badge" onClick={() => setMostrarAgendados(v => !v)}>
                      ⏰ {agendamentos.length}
                    </button>
                  )}

                  {/* Etiqueta dropdown */}
                  <div className="crm-etiqueta-wrap">
                    <button className="crm-etiqueta-select" onClick={() => setMostrarEtiquetas(v => !v)} style={{ color: etiquetaInfo(leadSelecionado.etiqueta).cor, borderColor: etiquetaInfo(leadSelecionado.etiqueta).cor + "44", background: etiquetaInfo(leadSelecionado.etiqueta).cor + "15" }}>
                      {etiquetaInfo(leadSelecionado.etiqueta).label} ▾
                    </button>
                    {mostrarEtiquetas && (
                      <div className="crm-etiqueta-dropdown">
                        {ETIQUETAS.map(et => (
                          <button key={et.valor} className={`crm-etiqueta-opt ${leadSelecionado.etiqueta === et.valor ? "et-ativo" : ""}`} onClick={() => trocarEtiqueta(et.valor)}>
                            <span className="et-dot" style={{ background: et.cor }} />{et.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Painel de agendados (overlay) */}
              {mostrarAgendados && (
                <div className="crm-panel-overlay">
                  <div className="crm-panel">
                    <div className="crm-panel-header">
                      <span className="crm-panel-title">Mensagens agendadas</span>
                      <button className="crm-panel-close" onClick={() => setMostrarAgendados(false)}>✕</button>
                    </div>
                    {agendamentos.length === 0 ? <div className="crm-panel-vazio">Nenhuma mensagem agendada.</div> : (
                      <div className="crm-panel-list">
                        {agendamentos.map(a => (
                          <div key={a.id} className="crm-agend-item">
                            <div className="crm-agend-texto">{a.payload.texto?.slice(0, 80)}{(a.payload.texto?.length ?? 0) > 80 ? "…" : ""}</div>
                            <div className="crm-agend-meta">
                              <span className="crm-agend-data">{new Date(a.agendado_para).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                              <button className="crm-agend-cancel" onClick={() => cancelarAgendamento(a.id)}>Cancelar</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mensagens */}
              <div className="crm-msgs" onClick={() => { setMostrarEtiquetas(false); setMostrarTemplates(false); }}>
                {loadingMsgs ? <div className="crm-msgs-loading">Carregando mensagens…</div>
                : mensagens.length === 0 ? <div className="crm-msgs-vazio">Nenhuma mensagem ainda.</div>
                : mensagensComSeparador().map((item, i) => {
                  if (item.tipo === "data") return <div key={`d-${i}`} className="crm-data-sep"><span>{item.data}</span></div>;
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
                })}
                <div ref={chatEndRef} />
              </div>

              {/* ── Input area ── */}
              <div className="crm-input-area">
                {erroEnvio && <div className="crm-envio-erro">{erroEnvio}</div>}

                {/* Preview de arquivo selecionado */}
                {arquivo && !gravando && (
                  <div className="crm-file-preview">
                    <div className="crm-file-info">
                      <span className="crm-file-type">{tipoMidiaLabel(arquivo.type)}</span>
                      <span className="crm-file-name">{arquivo.name}</span>
                      <span className="crm-file-size">{(arquivo.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button className="crm-file-remove" onClick={() => { setArquivo(null); setCaption(""); }}>✕</button>
                  </div>
                )}

                {/* Gravação em andamento */}
                {gravando && (
                  <div className="crm-rec-bar">
                    <span className="crm-rec-dot" />
                    <span className="crm-rec-time">{formatSeg(tempoGrav)}</span>
                    <span className="crm-rec-label">Gravando áudio…</span>
                    <button className="crm-rec-cancel" onClick={cancelarGravacao}>Cancelar</button>
                    <button className="crm-rec-stop" onClick={pararGravacao}>Parar e enviar</button>
                  </div>
                )}

                {/* Modal agendar */}
                {mostrarAgendar && (
                  <div className="crm-agendar-box">
                    <div className="crm-agendar-header">
                      <span>Agendar mensagem</span>
                      <button className="crm-panel-close" onClick={() => setMostrarAgendar(false)}>✕</button>
                    </div>
                    <textarea className="crm-textarea crm-agendar-text" placeholder="Mensagem a enviar…" value={agendarTexto} onChange={e => setAgendarTexto(e.target.value)} rows={3} />
                    <div className="crm-agendar-row">
                      <input type="date" className="crm-agendar-input" value={agendarData} onChange={e => setAgendarData(e.target.value)} />
                      <input type="time" className="crm-agendar-input" value={agendarHora} onChange={e => setAgendarHora(e.target.value)} />
                      <button className="crm-agendar-btn" onClick={criarAgendamento} disabled={salvandoAgend || !agendarTexto.trim() || !agendarData || !agendarHora}>
                        {salvandoAgend ? "Agendando…" : "Agendar"}
                      </button>
                    </div>
                    {/* Lista rápida de templates para usar no agendamento */}
                    {templates.length > 0 && (
                      <div className="crm-agendar-tpls">
                        <span className="crm-agendar-tpls-label">Templates:</span>
                        {templates.map(t => (
                          <button key={t.id} className="crm-agendar-tpl-btn" onClick={() => setAgendarTexto(t.conteudo)}>{t.nome}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Salvar template */}
                {mostrarSalvarTpl && (
                  <div className="crm-salvar-tpl-box">
                    <input className="crm-salvar-tpl-input" placeholder="Nome do template (ex: Follow-up D1)" value={novoTplNome} onChange={e => setNovoTplNome(e.target.value)} />
                    <button className="crm-salvar-tpl-btn" onClick={salvarTemplate} disabled={salvandoTpl || !novoTplNome.trim() || !texto.trim()}>
                      {salvandoTpl ? "Salvando…" : "Salvar"}
                    </button>
                    <button className="crm-salvar-tpl-cancel" onClick={() => { setMostrarSalvarTpl(false); setNovoTplNome(""); }}>Cancelar</button>
                  </div>
                )}

                {/* Toolbar */}
                {!gravando && (
                  <div className="crm-toolbar">
                    <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setArquivo(e.target.files[0]); } e.target.value = ""; }} />
                    <button className="crm-tool-btn" onClick={() => fileInputRef.current?.click()} title="Enviar arquivo">📎</button>
                    <button className="crm-tool-btn" onClick={iniciarGravacao} title="Gravar áudio">🎤</button>
                    <div className="crm-tool-sep" />

                    {/* Templates dropdown */}
                    <div className="crm-tpl-wrap">
                      <button className="crm-tool-btn" onClick={() => setMostrarTemplates(v => !v)} title="Templates de follow-up">📋</button>
                      {mostrarTemplates && (
                        <div className="crm-tpl-dropdown">
                          <div className="crm-tpl-header">Templates</div>
                          {templates.length === 0 ? <div className="crm-tpl-vazio">Nenhum template. Digite uma mensagem e clique em "Salvar como template".</div> : templates.map(tpl => (
                            <div key={tpl.id} className="crm-tpl-item">
                              <button className="crm-tpl-use" onClick={() => usarTemplate(tpl)}>
                                <span className="crm-tpl-nome">{tpl.nome}</span>
                                <span className="crm-tpl-prev">{tpl.conteudo.slice(0, 50)}{tpl.conteudo.length > 50 ? "…" : ""}</span>
                              </button>
                              <button className="crm-tpl-del" onClick={() => deletarTemplate(tpl.id)}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button className="crm-tool-btn" onClick={() => setMostrarAgendar(v => !v)} title="Agendar mensagem">⏰</button>
                    {texto.trim() && <button className="crm-tool-btn crm-tool-save" onClick={() => setMostrarSalvarTpl(v => !v)} title="Salvar como template">💾</button>}
                  </div>
                )}

                {/* Input principal */}
                {!gravando && !mostrarAgendar && (
                  <div className="crm-input-row">
                    {arquivo ? (
                      <input className="crm-textarea" placeholder="Legenda (opcional)…" value={caption} onChange={e => setCaption(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                    ) : (
                      <textarea ref={inputRef} className="crm-textarea" placeholder="Digite uma mensagem…" value={texto} rows={1} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                    )}
                    <button className="crm-send-btn" onClick={enviar} disabled={enviando || (!texto.trim() && !arquivo)}>
                      {enviando ? "…" : "➤"}
                    </button>
                  </div>
                )}
                {!gravando && !mostrarAgendar && <div className="crm-input-hint">Enter para enviar · Shift+Enter para nova linha</div>}
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

  /* sidebar */
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

  /* chat */
  .crm-chat{flex:1;display:flex;flex-direction:column;min-width:0;background:#0e0f09;}
  .crm-chat-vazio{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#4a3e30;}
  .crm-chat-vazio-icon{font-size:36px;opacity:.3;}
  .crm-chat-vazio p{font-size:14px;}
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
  .crm-agendados-badge{background:rgba(160,122,224,.1);border:1px solid rgba(160,122,224,.3);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;color:#a07ae0;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .crm-agendados-badge:hover{background:rgba(160,122,224,.2);}

  /* etiqueta dropdown */
  .crm-etiqueta-wrap{position:relative;}
  .crm-etiqueta-select{font-size:11px;font-weight:600;padding:6px 10px;border-radius:99px;border:1px solid;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .crm-etiqueta-dropdown{position:absolute;right:0;top:calc(100% + 6px);background:#1a1410;border:1px solid #2a1f18;border-radius:10px;min-width:200px;z-index:50;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.4);}
  .crm-etiqueta-opt{width:100%;background:none;border:none;padding:10px 14px;font-size:13px;color:#7a6e5e;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:8px;transition:background .1s;text-align:left;}
  .crm-etiqueta-opt:hover{background:rgba(255,255,255,.04);color:#fff9e6;}
  .et-ativo{color:#fff9e6!important;background:rgba(255,255,255,.05)!important;}
  .et-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}

  /* painel overlay (agendados) */
  .crm-panel-overlay{position:absolute;right:0;top:60px;width:340px;max-height:400px;z-index:40;padding:8px;}
  .crm-panel{background:#1a1410;border:1px solid #2a1f18;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);max-height:380px;overflow-y:auto;}
  .crm-panel-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #2a1f18;}
  .crm-panel-title{font-size:14px;font-weight:600;color:#fff9e6;}
  .crm-panel-close{background:none;border:none;color:#4a3e30;font-size:14px;cursor:pointer;padding:0;}
  .crm-panel-close:hover{color:#e07070;}
  .crm-panel-vazio{padding:20px 16px;font-size:13px;color:#4a3e30;text-align:center;}
  .crm-panel-list{padding:8px;}
  .crm-agend-item{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:10px 12px;margin-bottom:6px;}
  .crm-agend-texto{font-size:13px;color:#fff9e6;line-height:1.4;margin-bottom:6px;white-space:pre-wrap;word-break:break-word;}
  .crm-agend-meta{display:flex;justify-content:space-between;align-items:center;}
  .crm-agend-data{font-size:11px;color:#a07ae0;font-weight:600;}
  .crm-agend-cancel{background:none;border:1px solid rgba(224,88,64,.3);border-radius:6px;padding:4px 10px;font-size:11px;color:#e07070;cursor:pointer;font-family:inherit;}
  .crm-agend-cancel:hover{background:rgba(224,88,64,.1);}

  /* mensagens */
  .crm-msgs{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:2px;position:relative;}
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

  /* input area */
  .crm-input-area{padding:10px 16px 12px;border-top:1px solid #2a1f18;background:#111009;flex-shrink:0;}
  .crm-envio-erro{font-size:12px;color:#e07070;margin-bottom:6px;}
  .crm-input-row{display:flex;gap:10px;align-items:flex-end;}
  .crm-textarea{flex:1;background:#0e0f09;border:1px solid #2a1f18;border-radius:12px;padding:10px 14px;font-size:14px;color:#fff9e6;font-family:inherit;line-height:1.5;resize:none;outline:none;transition:border-color .2s;max-height:140px;overflow-y:auto;}
  .crm-textarea:focus{border-color:rgba(194,144,77,.4);}
  .crm-textarea::placeholder{color:#4a3e30;}
  .crm-send-btn{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#c2904d,#d4a055);border:none;color:#0e0f09;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}
  .crm-send-btn:hover:not(:disabled){filter:brightness(1.1);}
  .crm-send-btn:disabled{opacity:.4;cursor:not-allowed;}
  .crm-input-hint{font-size:11px;color:#2a1f18;margin-top:5px;}

  /* file preview */
  .crm-file-preview{display:flex;align-items:center;gap:10px;background:rgba(194,144,77,.06);border:1px solid rgba(194,144,77,.15);border-radius:10px;padding:8px 12px;margin-bottom:8px;}
  .crm-file-info{flex:1;display:flex;gap:8px;align-items:center;min-width:0;}
  .crm-file-type{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#c2904d;background:rgba(194,144,77,.1);padding:2px 6px;border-radius:4px;flex-shrink:0;}
  .crm-file-name{font-size:13px;color:#fff9e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .crm-file-size{font-size:11px;color:#4a3e30;flex-shrink:0;}
  .crm-file-remove{background:none;border:none;color:#e07070;font-size:14px;cursor:pointer;padding:0 4px;}
  .crm-file-remove:hover{color:#ff8888;}

  /* recording bar */
  .crm-rec-bar{display:flex;align-items:center;gap:10px;background:rgba(224,88,64,.08);border:1px solid rgba(224,88,64,.2);border-radius:10px;padding:10px 14px;margin-bottom:8px;}
  .crm-rec-dot{width:10px;height:10px;border-radius:50%;background:#e05840;animation:pulse 1s infinite;flex-shrink:0;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .crm-rec-time{font-size:16px;font-weight:700;color:#e07070;font-family:monospace;min-width:48px;}
  .crm-rec-label{flex:1;font-size:13px;color:#7a6e5e;}
  .crm-rec-cancel{background:none;border:1px solid #2a1f18;border-radius:8px;padding:6px 12px;font-size:12px;color:#7a6e5e;cursor:pointer;font-family:inherit;}
  .crm-rec-cancel:hover{color:#e07070;border-color:rgba(224,88,64,.3);}
  .crm-rec-stop{background:rgba(106,204,160,.1);border:1px solid rgba(106,204,160,.3);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;color:#6acca0;cursor:pointer;font-family:inherit;}
  .crm-rec-stop:hover{background:rgba(106,204,160,.2);}

  /* toolbar */
  .crm-toolbar{display:flex;align-items:center;gap:4px;margin-bottom:8px;}
  .crm-tool-btn{background:none;border:1px solid transparent;border-radius:8px;padding:6px 8px;font-size:16px;cursor:pointer;transition:all .15s;line-height:1;}
  .crm-tool-btn:hover{background:rgba(255,255,255,.04);border-color:#2a1f18;}
  .crm-tool-save{font-size:14px;}
  .crm-tool-sep{width:1px;height:18px;background:#2a1f18;margin:0 4px;}

  /* template dropdown */
  .crm-tpl-wrap{position:relative;}
  .crm-tpl-dropdown{position:absolute;left:0;bottom:calc(100% + 8px);background:#1a1410;border:1px solid #2a1f18;border-radius:10px;width:300px;max-height:320px;overflow-y:auto;z-index:50;box-shadow:0 8px 24px rgba(0,0,0,.4);}
  .crm-tpl-header{font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a3e30;padding:12px 14px;border-bottom:1px solid #2a1f18;}
  .crm-tpl-vazio{padding:16px 14px;font-size:12px;color:#4a3e30;line-height:1.5;}
  .crm-tpl-item{display:flex;align-items:center;border-bottom:1px solid rgba(42,31,24,.5);}
  .crm-tpl-item:last-child{border-bottom:none;}
  .crm-tpl-use{flex:1;background:none;border:none;padding:10px 14px;cursor:pointer;font-family:inherit;text-align:left;transition:background .1s;}
  .crm-tpl-use:hover{background:rgba(255,255,255,.03);}
  .crm-tpl-nome{display:block;font-size:13px;font-weight:600;color:#c2904d;margin-bottom:2px;}
  .crm-tpl-prev{display:block;font-size:12px;color:#7a6e5e;line-height:1.4;}
  .crm-tpl-del{background:none;border:none;color:#4a3e30;font-size:12px;cursor:pointer;padding:8px 12px;}
  .crm-tpl-del:hover{color:#e07070;}

  /* agendar box */
  .crm-agendar-box{background:#1a1410;border:1px solid #2a1f18;border-radius:12px;padding:14px;margin-bottom:8px;}
  .crm-agendar-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:14px;font-weight:600;color:#fff9e6;}
  .crm-agendar-text{margin-bottom:10px;min-height:60px;}
  .crm-agendar-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  .crm-agendar-input{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:8px 12px;font-size:13px;color:#fff9e6;font-family:inherit;outline:none;}
  .crm-agendar-input:focus{border-color:rgba(194,144,77,.4);}
  .crm-agendar-btn{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
  .crm-agendar-btn:disabled{opacity:.4;cursor:not-allowed;}
  .crm-agendar-tpls{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center;}
  .crm-agendar-tpls-label{font-size:11px;color:#4a3e30;}
  .crm-agendar-tpl-btn{background:rgba(194,144,77,.08);border:1px solid rgba(194,144,77,.2);border-radius:6px;padding:4px 10px;font-size:11px;color:#c2904d;cursor:pointer;font-family:inherit;}
  .crm-agendar-tpl-btn:hover{background:rgba(194,144,77,.15);}

  /* salvar template */
  .crm-salvar-tpl-box{display:flex;gap:8px;align-items:center;margin-bottom:8px;}
  .crm-salvar-tpl-input{flex:1;background:#0e0f09;border:1px solid #2a1f18;border-radius:8px;padding:8px 12px;font-size:13px;color:#fff9e6;font-family:inherit;outline:none;}
  .crm-salvar-tpl-input:focus{border-color:rgba(194,144,77,.4);}
  .crm-salvar-tpl-input::placeholder{color:#4a3e30;}
  .crm-salvar-tpl-btn{background:#c2904d;color:#0e0f09;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}
  .crm-salvar-tpl-btn:disabled{opacity:.4;}
  .crm-salvar-tpl-cancel{background:none;border:1px solid #2a1f18;border-radius:8px;padding:7px 12px;font-size:12px;color:#7a6e5e;cursor:pointer;font-family:inherit;white-space:nowrap;}

  /* mobile */
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
    .crm-panel-overlay{width:100%;right:0;padding:4px;}
    .crm-tpl-dropdown{width:260px;}
  }
`;

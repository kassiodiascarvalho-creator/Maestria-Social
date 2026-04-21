"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── tipos ────────────────────────────────────────────────────────────────────
type EtapaDB = { id: string; slug: string; label: string; cor: string; emoji: string | null; icone_url: string | null; is_final: boolean; ordem: number };

const PILARES: Record<string, string> = {
  A: "Sociabilidade", B: "Comunicação", C: "Relacionamento", D: "Persuasão", E: "Influência",
};
const CAMPOS: Record<string, string> = {
  maior_dor: "Maior Dor", contexto: "Contexto", interesse: "Interesse",
  objecao: "Objeção", objetivo: "Objetivo", urgencia: "Urgência",
  orcamento: "Orçamento", outro: "Outro",
};

type KanbanLead = {
  id: string; nome: string; email: string; whatsapp: string;
  qs_total: number | null; nivel_qs: string | null; pilar_fraco: string | null;
  scores: Record<string, number> | null;
  status_lead: "frio" | "morno" | "quente";
  etiqueta: string; pipeline_etapa: string; origem: string | null;
  criado_em: string; notas_crm: string | null;
  ultima_mensagem: string; ultima_role: string; ultima_atividade: string;
  num_qualificacoes: number;
};
type Qualificacao = { id: string; campo: string; valor: string; criado_em: string };
type LeadDetalhe = KanbanLead & { qualificacoes: Qualificacao[] };
type Mensagem = { id: string; role: "user" | "assistant"; mensagem: string; criado_em: string };
type Template = { id: string; nome: string; conteudo: string; criado_em: string };
type Agendamento = { id: string; lead_id: string; payload: { texto?: string }; agendado_para: string; status: string };

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
function scoreColor(n: number | null): string {
  if (n == null) return "#4a3e30";
  if (n >= 175) return "#6acca0";
  if (n >= 100) return "#c2904d";
  return "#e07070";
}
function tempColor(s: string): string {
  return s === "quente" ? "#e07070" : s === "morno" ? "#c2904d" : "#7ab0e0";
}
function tempEmoji(s: string): string {
  return s === "quente" ? "🔥" : s === "morno" ? "⚡" : "❄️";
}
function urgente(lead: KanbanLead): boolean {
  if (lead.status_lead === "frio") return false;
  if (!lead.ultima_atividade) return false;
  return Date.now() - new Date(lead.ultima_atividade).getTime() > 12 * 60 * 60 * 1000;
}

const ETIQUETAS_CHAT = [
  { valor: "ia_atendendo",          label: "IA atendendo",         cor: "#6acca0" },
  { valor: "humano_atendendo",      label: "Humano",               cor: "#c2904d" },
  { valor: "aguardando_agendamento",label: "Aguardando",           cor: "#7ab0e0" },
  { valor: "agendado",              label: "Agendado",             cor: "#a07ae0" },
  { valor: "fechado",               label: "Fechado",              cor: "#e07070" },
];
function etiquetaInfo(val: string) {
  return ETIQUETAS_CHAT.find(e => e.valor === val) ?? { valor: val, label: val, cor: "#7a6e5e" };
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function CRMPage() {
  // ── vista e dados globais ──────────────────────────────────────────────────
  const [view, setView] = useState<"kanban" | "chat">("kanban");
  const [leads, setLeads] = useState<KanbanLead[]>([]);
  const [etapas, setEtapas] = useState<EtapaDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");

  // ── kanban ────────────────────────────────────────────────────────────────
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragOverEtapa, setDragOverEtapa] = useState<string | null>(null);

  // ── chat ──────────────────────────────────────────────────────────────────
  const [leadSelecionado, setLeadSelecionado] = useState<KanbanLead | null>(null);
  const [leadDetalhe, setLeadDetalhe] = useState<LeadDetalhe | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(false);
  const [trocandoEtiqueta, setTrocandoEtiqueta] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(true);

  // ── arquivo/mídia ─────────────────────────────────────────────────────────
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── gravação ──────────────────────────────────────────────────────────────
  const [gravando, setGravando] = useState(false);
  const [tempoGrav, setTempoGrav] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const gravTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── templates ─────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mostrarTemplates, setMostrarTemplates] = useState(false);
  const [mostrarSalvarTpl, setMostrarSalvarTpl] = useState(false);
  const [novoTplNome, setNovoTplNome] = useState("");
  const [salvandoTpl, setSalvandoTpl] = useState(false);

  // ── agendamento ───────────────────────────────────────────────────────────
  const [mostrarAgendar, setMostrarAgendar] = useState(false);
  const [agendarTexto, setAgendarTexto] = useState("");
  const [agendarData, setAgendarData] = useState("");
  const [agendarHora, setAgendarHora] = useState("");
  const [salvandoAgend, setSalvandoAgend] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [mostrarAgendados, setMostrarAgendados] = useState(false);

  const notasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── carrega leads (kanban API — todos os dados de uma vez) ─────────────
  const carregarLeads = useCallback(async () => {
    const res = await fetch("/api/admin/crm/kanban").then(r => r.json()).catch(() => []);
    setLeads(Array.isArray(res) ? res : []);
    setLoading(false);
  }, []);

  useEffect(() => { carregarLeads(); }, [carregarLeads]);

  useEffect(() => {
    fetch("/api/admin/pipeline/etapas").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setEtapas(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/crm/templates").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTemplates(d); }).catch(() => {});
  }, []);

  // ── Supabase Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const chConversas = supabase.channel("crm-conversas")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversas" }, payload => {
        const nova = payload.new as { lead_id: string; id: string; role: string; mensagem: string; criado_em: string };
        setLeads(prev => {
          const idx = prev.findIndex(l => l.id === nova.lead_id);
          if (idx === -1) { carregarLeads(); return prev; }
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

    const chLeads = supabase.channel("crm-leads")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, payload => {
        const a = payload.new as KanbanLead;
        setLeads(prev => prev.map(l => l.id === a.id
          ? { ...l, etiqueta: a.etiqueta, status_lead: a.status_lead, pipeline_etapa: a.pipeline_etapa, notas_crm: a.notas_crm }
          : l
        ));
        setLeadSelecionado(prev => prev?.id === a.id ? { ...prev, etiqueta: a.etiqueta, pipeline_etapa: a.pipeline_etapa } : prev);
        setLeadDetalhe(prev => prev?.id === a.id ? { ...prev, etiqueta: a.etiqueta, pipeline_etapa: a.pipeline_etapa } : prev);
      }).subscribe();

    return () => { supabase.removeChannel(chConversas); supabase.removeChannel(chLeads); };
  }, [carregarLeads]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens]);

  // ── seleciona lead ────────────────────────────────────────────────────────
  async function selecionarLead(lead: KanbanLead) {
    setLeadSelecionado(lead);
    setView("chat");
    setErroEnvio(""); setMostrarEtiquetas(false);
    setArquivo(null); setCaption("");
    setMostrarAgendar(false); setMostrarAgendados(false); setMostrarTemplates(false);
    setLeadDetalhe(null);
    setLoadingMsgs(true);

    const [msgs, detalhe, agend] = await Promise.all([
      fetch(`/api/admin/crm/conversas/${lead.id}`).then(r => r.json()).catch(() => []),
      fetch(`/api/admin/crm/leads/${lead.id}`).then(r => r.json()).catch(() => null),
      fetch(`/api/admin/crm/agendar?lead_id=${lead.id}`).then(r => r.json()).catch(() => []),
    ]);
    setMensagens(Array.isArray(msgs) ? msgs : []);
    setLoadingMsgs(false);
    if (detalhe && !detalhe.error) setLeadDetalhe(detalhe);
    setAgendamentos(Array.isArray(agend) ? agend.filter((a: Agendamento) => a.status === "pendente") : []);
  }

  // ── enviar mensagem ───────────────────────────────────────────────────────
  async function enviar() {
    if (!leadSelecionado || enviando || (!texto.trim() && !arquivo)) return;
    setEnviando(true); setErroEnvio("");
    const form = new FormData();
    form.append("lead_id", leadSelecionado.id);
    if (arquivo) { form.append("file", arquivo); if (caption.trim()) form.append("caption", caption.trim()); }
    else form.append("texto", texto.trim());
    const res = await fetch("/api/admin/enviar-mensagem", { method: "POST", body: form });
    if (!res.ok) {
      const d = await res.json(); setErroEnvio(d.error || "Erro ao enviar");
    } else {
      setTexto(""); setArquivo(null); setCaption("");
      const upd = { etiqueta: "humano_atendendo" };
      setLeadSelecionado(prev => prev ? { ...prev, ...upd } : prev);
      setLeads(prev => prev.map(l => l.id === leadSelecionado.id ? { ...l, ...upd } : l));
    }
    setEnviando(false); inputRef.current?.focus();
  }

  // ── gravação de áudio ─────────────────────────────────────────────────────
  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        setArquivo(new File([blob], `audio-gravado.${ext}`, { type: mimeType }));
        setGravando(false); setTempoGrav(0);
        if (gravTimerRef.current) clearInterval(gravTimerRef.current);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setGravando(true);
      gravTimerRef.current = setInterval(() => setTempoGrav(t => t + 1), 1000);
    } catch { alert("Não foi possível acessar o microfone."); }
  }
  function pararGravacao() { mediaRecorderRef.current?.stop(); }
  function cancelarGravacao() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      audioChunksRef.current = [];
    }
    setGravando(false); setTempoGrav(0);
    if (gravTimerRef.current) clearInterval(gravTimerRef.current);
  }

  // ── templates ─────────────────────────────────────────────────────────────
  function usarTemplate(tpl: Template) { setTexto(tpl.conteudo); setMostrarTemplates(false); inputRef.current?.focus(); }
  async function salvarTemplate() {
    if (!novoTplNome.trim() || !texto.trim()) return;
    setSalvandoTpl(true);
    const res = await fetch("/api/admin/crm/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: novoTplNome.trim(), conteudo: texto.trim() }) }).then(r => r.json());
    if (!res.error) { setTemplates(t => [res, ...t]); setMostrarSalvarTpl(false); setNovoTplNome(""); }
    setSalvandoTpl(false);
  }
  async function deletarTemplate(id: string) {
    await fetch(`/api/admin/crm/templates/${id}`, { method: "DELETE" });
    setTemplates(t => t.filter(x => x.id !== id));
  }

  // ── agendamento ───────────────────────────────────────────────────────────
  async function criarAgendamento() {
    if (!leadSelecionado || !agendarTexto.trim() || !agendarData || !agendarHora) return;
    setSalvandoAgend(true);
    const agendado_para = new Date(`${agendarData}T${agendarHora}`).toISOString();
    const res = await fetch("/api/admin/crm/agendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: leadSelecionado.id, texto: agendarTexto.trim(), agendado_para }) }).then(r => r.json());
    if (!res.error) { setAgendamentos(prev => [...prev, res]); setMostrarAgendar(false); setAgendarTexto(""); setAgendarData(""); setAgendarHora(""); }
    else alert(res.error);
    setSalvandoAgend(false);
  }
  async function cancelarAgendamento(id: string) {
    await fetch("/api/admin/crm/agendar", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setAgendamentos(prev => prev.filter(a => a.id !== id));
  }

  // ── etiqueta & pipeline ───────────────────────────────────────────────────
  async function trocarEtiqueta(etiqueta: string) {
    if (!leadSelecionado || trocandoEtiqueta) return;
    setTrocandoEtiqueta(true);
    await fetch(`/api/admin/crm/leads/${leadSelecionado.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ etiqueta }) });
    setLeadSelecionado(prev => prev ? { ...prev, etiqueta } : prev);
    setLeads(prev => prev.map(l => l.id === leadSelecionado.id ? { ...l, etiqueta } : l));
    setMostrarEtiquetas(false); setTrocandoEtiqueta(false);
  }
  async function moverParaEtapa(leadId: string, etapa: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_etapa: etapa } : l));
    setLeadDetalhe(prev => prev?.id === leadId ? { ...prev, pipeline_etapa: etapa } : prev);
    await fetch(`/api/admin/crm/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipeline_etapa: etapa }) });
  }

  // ── notas (auto-save com debounce) ────────────────────────────────────────
  function salvarNotasDebounced(leadId: string, notas: string) {
    if (notasTimer.current) clearTimeout(notasTimer.current);
    setLeadDetalhe(prev => prev ? { ...prev, notas_crm: notas } : prev);
    notasTimer.current = setTimeout(async () => {
      await fetch(`/api/admin/crm/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notas_crm: notas }) });
    }, 800);
  }

  // ── mensagens com separadores de data ─────────────────────────────────────
  function mensagensComSeparador() {
    const result: ({ tipo: "data"; data: string } | { tipo: "msg"; msg: Mensagem })[] = [];
    let ultimaData = "";
    for (const msg of mensagens) {
      const data = dataMsg(msg.criado_em);
      if (data !== ultimaData) { result.push({ tipo: "data", data }); ultimaData = data; }
      result.push({ tipo: "msg", msg });
    }
    return result;
  }

  // ── dados derivados ───────────────────────────────────────────────────────
  const semanaPas = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stats = {
    total: leads.length,
    semana: leads.filter(l => new Date(l.criado_em) > semanaPas).length,
    quentes: leads.filter(l => l.status_lead === "quente").length,
    convertidos: leads.filter(l => l.pipeline_etapa === "convertido").length,
    taxa: leads.length > 0 ? Math.round((leads.filter(l => l.pipeline_etapa === "convertido").length / leads.length) * 100) : 0,
    urgentes: leads.filter(urgente).length,
  };

  const leadsChat = leads
    .filter(l => {
      if (filtroEtiqueta && l.etiqueta !== filtroEtiqueta) return false;
      if (busca) { const b = busca.toLowerCase(); return l.nome.toLowerCase().includes(b) || l.whatsapp.includes(b); }
      return true;
    })
    .sort((a, b) => (b.ultima_atividade || b.criado_em).localeCompare(a.ultima_atividade || a.criado_em));

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>

      {/* ── Topbar global ── */}
      <div className="crm-topbar">
        <div className="crm-topbar-left">
          <h1 className="crm-h1">WhatsApp CRM</h1>
          <div className="crm-view-toggle">
            <button className={`cvt-btn ${view === "kanban" ? "cvt-active" : ""}`} onClick={() => setView("kanban")}>
              ◈ Pipeline
            </button>
            <button className={`cvt-btn ${view === "chat" ? "cvt-active" : ""}`} onClick={() => setView("chat")}>
              ◉ Chat
            </button>
          </div>
        </div>
        <input className="crm-topbar-search" placeholder="Buscar lead…" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          KANBAN VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "kanban" && (
        <div className="kb-root">
          {/* Stats bar */}
          <div className="kb-stats">
            <div className="kb-stat">
              <span className="kb-stat-num">{loading ? "—" : stats.total}</span>
              <span className="kb-stat-label">Total de leads</span>
            </div>
            <div className="kb-stat-divider" />
            <div className="kb-stat">
              <span className="kb-stat-num">{loading ? "—" : stats.semana}</span>
              <span className="kb-stat-label">Esta semana</span>
            </div>
            <div className="kb-stat-divider" />
            <div className="kb-stat">
              <span className="kb-stat-num" style={{ color: "#e07070" }}>{loading ? "—" : stats.quentes}</span>
              <span className="kb-stat-label">🔥 Quentes</span>
            </div>
            <div className="kb-stat-divider" />
            <div className="kb-stat">
              <span className="kb-stat-num" style={{ color: "#f0c040" }}>{loading ? "—" : stats.convertidos}</span>
              <span className="kb-stat-label">✅ Convertidos</span>
            </div>
            <div className="kb-stat-divider" />
            <div className="kb-stat">
              <span className="kb-stat-num" style={{ color: "#6acca0" }}>{loading ? "—" : `${stats.taxa}%`}</span>
              <span className="kb-stat-label">Taxa de conv.</span>
            </div>
            {stats.urgentes > 0 && (
              <>
                <div className="kb-stat-divider" />
                <div className="kb-stat">
                  <span className="kb-stat-num" style={{ color: "#ff6b6b" }}>⚠️ {stats.urgentes}</span>
                  <span className="kb-stat-label">Precisam atenção</span>
                </div>
              </>
            )}
          </div>

          {/* Board */}
          <div className="kb-board">
            {etapas.map(etapa => {
              const cards = leads
                .filter(l => {
                  if (l.pipeline_etapa !== etapa.slug) return false;
                  if (busca) { const b = busca.toLowerCase(); return l.nome.toLowerCase().includes(b) || l.whatsapp.includes(b); }
                  return true;
                })
                .sort((a, b) => (b.ultima_atividade || b.criado_em).localeCompare(a.ultima_atividade || a.criado_em));

              const icone = etapa.icone_url
                ? <img src={etapa.icone_url} alt="" style={{ width: 16, height: 16, objectFit: "contain", display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                : (etapa.emoji ? <span>{etapa.emoji} </span> : null);

              return (
                <div
                  key={etapa.slug}
                  className={`kb-col ${dragOverEtapa === etapa.slug ? "kb-col-dragover" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOverEtapa(etapa.slug); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverEtapa(null); }}
                  onDrop={e => {
                    e.preventDefault(); setDragOverEtapa(null);
                    const id = e.dataTransfer.getData("lead_id");
                    if (id) moverParaEtapa(id, etapa.slug);
                  }}
                >
                  <div className="kb-col-header" style={{ borderTopColor: etapa.cor }}>
                    <span className="kb-col-title">{icone}{etapa.label}</span>
                    <span className="kb-col-count" style={{ background: etapa.cor + "22", color: etapa.cor }}>
                      {cards.length}
                    </span>
                  </div>

                  <div className="kb-col-cards">
                    {loading ? (
                      <div className="kb-col-vazio">Carregando…</div>
                    ) : cards.length === 0 ? (
                      <div className="kb-col-vazio">Nenhum lead</div>
                    ) : cards.map(lead => (
                      <div
                        key={lead.id}
                        className={`kb-card ${urgente(lead) ? "kb-card-urgent" : ""}`}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData("lead_id", lead.id); setDragLeadId(lead.id); }}
                        onDragEnd={() => setDragLeadId(null)}
                        onClick={() => selecionarLead(lead)}
                        style={{ opacity: dragLeadId === lead.id ? 0.45 : 1 }}
                      >
                        {/* Topo */}
                        <div className="kb-card-top">
                          <div className="kb-avatar" style={{ borderColor: tempColor(lead.status_lead), background: tempColor(lead.status_lead) + "1a" }}>
                            {lead.nome[0].toUpperCase()}
                          </div>
                          <div className="kb-card-info">
                            <span className="kb-card-nome">{lead.nome}</span>
                            {lead.nivel_qs && <span className="kb-card-nivel">{lead.nivel_qs}</span>}
                          </div>
                          <span className="kb-card-temp" title={lead.status_lead}>{tempEmoji(lead.status_lead)}</span>
                        </div>

                        {/* Score bar */}
                        {lead.qs_total != null && (
                          <div className="kb-score-row">
                            <div className="kb-score-bar">
                              <div className="kb-score-fill" style={{ width: `${(lead.qs_total / 250) * 100}%`, background: scoreColor(lead.qs_total) }} />
                            </div>
                            <span className="kb-score-num" style={{ color: scoreColor(lead.qs_total) }}>{lead.qs_total}/250</span>
                          </div>
                        )}

                        {/* Última mensagem */}
                        {lead.ultima_mensagem && (
                          <div className="kb-card-msg">
                            <span className="kb-msg-icon">{lead.ultima_role === "user" ? "👤" : "🤖"}</span>
                            {lead.ultima_mensagem.slice(0, 62)}{lead.ultima_mensagem.length > 62 ? "…" : ""}
                          </div>
                        )}

                        {/* Rodapé */}
                        <div className="kb-card-footer">
                          <span className="kb-etq-dot" style={{ background: etiquetaInfo(lead.etiqueta).cor }} />
                          <span className="kb-etq-txt">{etiquetaInfo(lead.etiqueta).label}</span>
                          {lead.num_qualificacoes > 0 && (
                            <span className="kb-quals-badge" title={`${lead.num_qualificacoes} dados extraídos pela IA`}>
                              ✦ {lead.num_qualificacoes}
                            </span>
                          )}
                          {urgente(lead) && <span className="kb-urgente-dot" title="Sem resposta há +12h">⚠️</span>}
                          <span className="kb-card-time">{tempoRelativo(lead.ultima_atividade || lead.criado_em)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CHAT VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {view === "chat" && (
        <div className="crm-root">
          {/* ── Sidebar de leads ── */}
          <aside className="crm-sidebar">
            <div className="crm-sidebar-header">
              <button className="crm-back-btn" onClick={() => setView("kanban")}>← Pipeline</button>
              <div className="crm-filtros">
                {[
                  { valor: "", label: "Todos" },
                  { valor: "ia_atendendo", label: "IA" },
                  { valor: "humano_atendendo", label: "Humano" },
                  { valor: "agendado", label: "Agendado" },
                ].map(f => (
                  <button key={f.valor} className={`crm-filtro-btn ${filtroEtiqueta === f.valor ? "crm-filtro-ativo" : ""}`} onClick={() => setFiltroEtiqueta(f.valor)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="crm-list">
              {loading ? <div className="crm-loading">Carregando…</div>
               : leadsChat.length === 0 ? <div className="crm-vazio">Nenhuma conversa</div>
               : leadsChat.map(lead => {
                const et = etiquetaInfo(lead.etiqueta);
                return (
                  <button key={lead.id} className={`crm-conv-item ${leadSelecionado?.id === lead.id ? "crm-conv-ativo" : ""}`} onClick={() => selecionarLead(lead)}>
                    <div className="crm-conv-avatar" style={{ borderColor: tempColor(lead.status_lead), background: tempColor(lead.status_lead) + "15" }}>
                      {lead.nome[0].toUpperCase()}
                    </div>
                    <div className="crm-conv-body">
                      <div className="crm-conv-top">
                        <span className="crm-conv-nome">{lead.nome}</span>
                        <span className="crm-conv-time">{tempoRelativo(lead.ultima_atividade)}</span>
                      </div>
                      <div className="crm-conv-preview">
                        {lead.ultima_mensagem?.slice(0, 42)}{(lead.ultima_mensagem?.length ?? 0) > 42 ? "…" : ""}
                      </div>
                      <div className="crm-conv-badges">
                        <span className="crm-etq-badge" style={{ background: et.cor + "22", color: et.cor }}>{et.label}</span>
                        {lead.qs_total != null && (
                          <span className="crm-qs-badge" style={{ color: scoreColor(lead.qs_total) }}>QS {lead.qs_total}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ── Chat principal ── */}
          <main className="crm-main">
            {!leadSelecionado ? (
              <div className="crm-placeholder">
                <div className="crm-placeholder-icon">💬</div>
                <div>Selecione um lead para ver a conversa</div>
                <div className="crm-placeholder-sub">ou volte ao Pipeline para arrastar e organizar</div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="crm-chat-header">
                  <div className="crm-chat-avatar" style={{ background: tempColor(leadSelecionado.status_lead) + "1a", borderColor: tempColor(leadSelecionado.status_lead) }}>
                    {leadSelecionado.nome[0].toUpperCase()}
                  </div>
                  <div className="crm-chat-info">
                    <span className="crm-chat-nome">{leadSelecionado.nome}</span>
                    <span className="crm-chat-phone">{leadSelecionado.whatsapp}</span>
                  </div>
                  <div className="crm-chat-actions">
                    <button className="crm-action-btn crm-btn-ia" onClick={() => trocarEtiqueta("ia_atendendo")}>🤖 IA</button>
                    <button className="crm-action-btn crm-btn-human" onClick={() => trocarEtiqueta("humano_atendendo")}>👤 Humano</button>
                    {agendamentos.length > 0 && (
                      <button className="crm-agendados-badge" onClick={() => setMostrarAgendados(v => !v)}>⏰ {agendamentos.length}</button>
                    )}
                    <div className="crm-etiqueta-wrap">
                      <button className="crm-etiqueta-select" onClick={() => setMostrarEtiquetas(v => !v)}
                        style={{ color: etiquetaInfo(leadSelecionado.etiqueta).cor, borderColor: etiquetaInfo(leadSelecionado.etiqueta).cor + "44", background: etiquetaInfo(leadSelecionado.etiqueta).cor + "12" }}>
                        {etiquetaInfo(leadSelecionado.etiqueta).label} ▾
                      </button>
                      {mostrarEtiquetas && (
                        <div className="crm-etiqueta-dropdown">
                          {ETIQUETAS_CHAT.map(et => (
                            <button key={et.valor} className={`crm-etiqueta-opt ${leadSelecionado.etiqueta === et.valor ? "et-ativo" : ""}`} onClick={() => trocarEtiqueta(et.valor)}>
                              <span className="et-dot" style={{ background: et.cor }} />{et.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="crm-perfil-toggle" onClick={() => setMostrarPerfil(v => !v)} title={mostrarPerfil ? "Ocultar perfil" : "Ver perfil"}>
                      {mostrarPerfil ? "⊳" : "⊲"}
                    </button>
                  </div>
                </div>

                {/* Agendados overlay */}
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

                {/* Input area */}
                <div className="crm-input-area">
                  {erroEnvio && <div className="crm-envio-erro">{erroEnvio}</div>}

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

                  {gravando && (
                    <div className="crm-rec-bar">
                      <span className="crm-rec-dot" />
                      <span className="crm-rec-time">{formatSeg(tempoGrav)}</span>
                      <span className="crm-rec-label">Gravando áudio…</span>
                      <button className="crm-rec-cancel" onClick={cancelarGravacao}>Cancelar</button>
                      <button className="crm-rec-stop" onClick={pararGravacao}>Parar e enviar</button>
                    </div>
                  )}

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

                  {mostrarSalvarTpl && (
                    <div className="crm-salvar-tpl-box">
                      <input className="crm-salvar-tpl-input" placeholder="Nome do template (ex: Follow-up D1)" value={novoTplNome} onChange={e => setNovoTplNome(e.target.value)} />
                      <button className="crm-salvar-tpl-btn" onClick={salvarTemplate} disabled={salvandoTpl || !novoTplNome.trim() || !texto.trim()}>
                        {salvandoTpl ? "Salvando…" : "Salvar"}
                      </button>
                      <button className="crm-salvar-tpl-cancel" onClick={() => { setMostrarSalvarTpl(false); setNovoTplNome(""); }}>Cancelar</button>
                    </div>
                  )}

                  {!gravando && (
                    <div className="crm-toolbar">
                      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) setArquivo(e.target.files[0]); e.target.value = ""; }} />
                      {/* Esquerda: arquivo + templates + agendar */}
                      <button className="crm-tool-btn" onClick={() => fileInputRef.current?.click()} title="Enviar arquivo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                      </button>
                      <div className="crm-tpl-wrap">
                        <button className="crm-tool-btn" onClick={() => setMostrarTemplates(v => !v)} title="Templates">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        </button>
                        {mostrarTemplates && (
                          <div className="crm-tpl-dropdown">
                            <div className="crm-tpl-header">Templates</div>
                            {templates.length === 0
                              ? <div className="crm-tpl-vazio">Nenhum template. Digite e clique em 💾.</div>
                              : templates.map(tpl => (
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
                      <button className="crm-tool-btn" onClick={() => setMostrarAgendar(v => !v)} title="Agendar mensagem">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </button>
                      {texto.trim() && (
                        <button className="crm-tool-btn crm-tool-save" onClick={() => setMostrarSalvarTpl(v => !v)} title="Salvar como template">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        </button>
                      )}
                    </div>
                  )}

                  {!gravando && !mostrarAgendar && (
                    <div className="crm-input-row">
                      {arquivo ? (
                        <input className="crm-textarea" placeholder="Legenda (opcional)…" value={caption} onChange={e => setCaption(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                      ) : (
                        <textarea ref={inputRef} className="crm-textarea" placeholder="Digite uma mensagem…" value={texto} rows={1} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                      )}
                      {/* Áudio: fica no canto direito, substitui envio quando não há texto */}
                      {!texto.trim() && !arquivo ? (
                        <button className="crm-mic-btn" onClick={iniciarGravacao} title="Gravar áudio">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                        </button>
                      ) : (
                        <button className="crm-send-btn" onClick={enviar} disabled={enviando || (!texto.trim() && !arquivo)}>
                          {enviando ? "…" : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {!gravando && !mostrarAgendar && (
                    <div className="crm-input-hint">Enter para enviar · Shift+Enter para nova linha</div>
                  )}
                </div>
              </>
            )}
          </main>

          {/* ── Painel do Lead (sidebar direita) ── */}
          {leadSelecionado && mostrarPerfil && (
            <aside className="ls-root">
              {!leadDetalhe ? (
                <div className="ls-loading">Carregando perfil…</div>
              ) : (
                <>
                  {/* Score gauge */}
                  <div className="ls-gauge-section">
                    <div className="ls-gauge-wrap">
                      <div className="ls-gauge" style={{
                        background: leadDetalhe.qs_total != null
                          ? `conic-gradient(${scoreColor(leadDetalhe.qs_total)} ${(leadDetalhe.qs_total / 250) * 360}deg, #1e1a14 0deg)`
                          : "#1e1a14"
                      }}>
                        <div className="ls-gauge-inner">
                          <span className="ls-gauge-num">{leadDetalhe.qs_total ?? "—"}</span>
                          <span className="ls-gauge-sub">/250</span>
                        </div>
                      </div>
                    </div>
                    {leadDetalhe.nivel_qs && <div className="ls-nivel-badge">{leadDetalhe.nivel_qs}</div>}
                    <div className="ls-temp-badge" style={{ color: tempColor(leadDetalhe.status_lead), borderColor: tempColor(leadDetalhe.status_lead) + "55" }}>
                      {tempEmoji(leadDetalhe.status_lead)} {leadDetalhe.status_lead.charAt(0).toUpperCase() + leadDetalhe.status_lead.slice(1)}
                    </div>
                  </div>

                  {/* Informações básicas */}
                  <div className="ls-info">
                    <div className="ls-info-row"><span className="ls-info-icon">📱</span><span className="ls-info-val">{leadDetalhe.whatsapp}</span></div>
                    <div className="ls-info-row"><span className="ls-info-icon">✉️</span><span className="ls-info-val ls-truncate">{leadDetalhe.email}</span></div>
                    {leadDetalhe.origem && <div className="ls-info-row"><span className="ls-info-icon">🔗</span><span className="ls-info-val">{leadDetalhe.origem}</span></div>}
                    {leadDetalhe.pilar_fraco && <div className="ls-info-row"><span className="ls-info-icon">⚠️</span><span className="ls-info-val">Gap: {leadDetalhe.pilar_fraco}</span></div>}
                    <div className="ls-info-row"><span className="ls-info-icon">📅</span><span className="ls-info-val">{new Date(leadDetalhe.criado_em).toLocaleDateString("pt-BR")}</span></div>
                  </div>

                  {/* Pipeline stage */}
                  <div className="ls-section">
                    <div className="ls-section-label">Etapa no Pipeline</div>
                    <div className="ls-pipeline-grid">
                      {etapas.map(e => (
                        <button key={e.slug}
                          className={`ls-pipeline-btn ${leadDetalhe.pipeline_etapa === e.slug ? "ls-pipeline-ativo" : ""}`}
                          style={leadDetalhe.pipeline_etapa === e.slug ? { background: e.cor + "22", color: e.cor, borderColor: e.cor + "55" } : {}}
                          onClick={() => moverParaEtapa(leadDetalhe.id, e.slug)}
                        >
                          {e.icone_url
                            ? <img src={e.icone_url} alt="" style={{ width: 14, height: 14, objectFit: "contain", display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                            : (e.emoji ? `${e.emoji} ` : "")}
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pilares QS */}
                  {leadDetalhe.scores && Object.keys(leadDetalhe.scores).length > 0 && (
                    <div className="ls-section">
                      <div className="ls-section-label">Quociente Social por Pilar</div>
                      {Object.entries(leadDetalhe.scores).map(([k, v]) => {
                        const pct = Math.round((v / 50) * 100);
                        const cor = v < 20 ? "#e07070" : v < 35 ? "#c2904d" : "#6acca0";
                        return (
                          <div key={k} className="ls-pilar-row">
                            <span className="ls-pilar-nome">{PILARES[k] || k}</span>
                            <div className="ls-pilar-bar">
                              <div className="ls-pilar-fill" style={{ width: `${pct}%`, background: cor }} />
                            </div>
                            <span className="ls-pilar-num" style={{ color: cor }}>{v}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Qualificações extraídas pela IA */}
                  {leadDetalhe.qualificacoes.length > 0 && (
                    <div className="ls-section">
                      <div className="ls-section-label">Inteligência extraída pela IA</div>
                      {leadDetalhe.qualificacoes.map(q => (
                        <div key={q.id} className="ls-qual-row">
                          <span className="ls-qual-campo">{CAMPOS[q.campo] || q.campo}</span>
                          <span className="ls-qual-valor">{q.valor}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notas internas */}
                  <div className="ls-section ls-notas-section">
                    <div className="ls-section-label">Notas internas</div>
                    <textarea
                      className="ls-notas"
                      placeholder="Anotações sobre o lead (só o time vê)…"
                      value={leadDetalhe.notas_crm || ""}
                      onChange={e => salvarNotasDebounced(leadDetalhe.id, e.target.value)}
                    />
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      )}
    </>
  );
}

// ─── estilos ──────────────────────────────────────────────────────────────────
const css = `
  /* ── Topbar ── */
  .crm-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:52px;background:#0e0f09;border-bottom:1px solid #2a1f18;flex-shrink:0;}
  .crm-topbar-left{display:flex;align-items:center;gap:16px;}
  .crm-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:700;color:#fff9e6;margin:0;}
  .crm-view-toggle{display:flex;background:#1a170f;border:1px solid #2a1f18;border-radius:8px;overflow:hidden;}
  .cvt-btn{padding:5px 14px;font-size:12px;font-family:inherit;color:#7a6e5e;background:transparent;border:none;cursor:pointer;transition:all .2s;}
  .cvt-btn:hover{color:#fff9e6;}
  .cvt-active{background:#c2904d22;color:#c2904d !important;}
  .crm-topbar-search{background:#1a170f;border:1px solid #2a1f18;border-radius:8px;padding:7px 14px;font-size:13px;color:#fff9e6;font-family:inherit;outline:none;width:220px;transition:border-color .2s;}
  .crm-topbar-search:focus{border-color:#c2904d55;}
  .crm-topbar-search::placeholder{color:#4a3e30;}

  /* ── Kanban root ── */
  .kb-root{display:flex;flex-direction:column;height:calc(100vh - 112px);overflow:hidden;background:#0a0b07;}

  /* Stats bar */
  .kb-stats{display:flex;align-items:center;gap:0;padding:0 20px;height:56px;background:#0e0f09;border-bottom:1px solid #2a1f18;flex-shrink:0;}
  .kb-stat{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 20px;}
  .kb-stat-num{font-size:20px;font-weight:700;color:#fff9e6;font-family:'Cormorant Garamond',Georgia,serif;line-height:1;}
  .kb-stat-label{font-size:10px;color:#5a4e40;margin-top:2px;text-transform:uppercase;letter-spacing:.5px;}
  .kb-stat-divider{width:1px;height:32px;background:#2a1f18;flex-shrink:0;}

  /* Board */
  .kb-board{display:flex;gap:0;overflow-x:auto;overflow-y:hidden;flex:1;padding:16px;gap:12px;}
  .kb-board::-webkit-scrollbar{height:6px;}
  .kb-board::-webkit-scrollbar-track{background:#0a0b07;}
  .kb-board::-webkit-scrollbar-thumb{background:#2a1f18;border-radius:3px;}

  /* Column */
  .kb-col{display:flex;flex-direction:column;min-width:270px;max-width:270px;background:#111009;border-radius:12px;overflow:hidden;border:1px solid #2a1f18;transition:border-color .2s;}
  .kb-col-dragover{border-color:#c2904d55;background:#c2904d08;}
  .kb-col-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-top:3px solid transparent;border-bottom:1px solid #1e1a14;flex-shrink:0;}
  .kb-col-title{font-size:12px;font-weight:600;color:#c8b99a;letter-spacing:.3px;}
  .kb-col-count{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;}
  .kb-col-cards{display:flex;flex-direction:column;gap:8px;overflow-y:auto;padding:10px;flex:1;}
  .kb-col-cards::-webkit-scrollbar{width:4px;}
  .kb-col-cards::-webkit-scrollbar-thumb{background:#2a1f18;border-radius:2px;}
  .kb-col-vazio{font-size:12px;color:#3a3028;text-align:center;padding:20px 0;font-style:italic;}
  .kb-loading{font-size:12px;color:#3a3028;text-align:center;padding:20px 0;}

  /* Card */
  .kb-card{background:#0e0f09;border:1px solid #2a1f18;border-radius:10px;padding:11px 12px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:7px;}
  .kb-card:hover{border-color:#c2904d44;background:#141208;transform:translateY(-1px);box-shadow:0 4px 12px #00000040;}
  .kb-card-urgent{border-color:#e0707044 !important;background:#e070700a !important;}
  .kb-card-top{display:flex;align-items:center;gap:9px;}
  .kb-avatar{width:32px;height:32px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff9e6;flex-shrink:0;}
  .kb-card-info{display:flex;flex-direction:column;flex:1;min-width:0;}
  .kb-card-nome{font-size:13px;font-weight:600;color:#fff9e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .kb-card-nivel{font-size:10px;color:#7a6e5e;margin-top:1px;}
  .kb-card-temp{font-size:15px;flex-shrink:0;}
  .kb-score-row{display:flex;align-items:center;gap:7px;}
  .kb-score-bar{flex:1;height:3px;background:#1e1a14;border-radius:2px;overflow:hidden;}
  .kb-score-fill{height:100%;border-radius:2px;transition:width .4s;}
  .kb-score-num{font-size:10px;font-weight:600;white-space:nowrap;}
  .kb-card-msg{font-size:11px;color:#5a4e40;line-height:1.4;display:flex;gap:5px;align-items:flex-start;}
  .kb-msg-icon{flex-shrink:0;font-size:10px;}
  .kb-card-footer{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
  .kb-etq-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
  .kb-etq-txt{font-size:10px;color:#5a4e40;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .kb-quals-badge{font-size:9px;color:#c2904d;background:#c2904d15;padding:1px 5px;border-radius:4px;}
  .kb-urgente-dot{font-size:10px;}
  .kb-card-time{font-size:10px;color:#3a3028;margin-left:auto;}

  /* ── Chat view ── */
  .crm-root{display:flex;height:calc(100vh - 112px);overflow:hidden;background:#0e0f09;}

  /* Sidebar */
  .crm-sidebar{width:290px;flex-shrink:0;background:#111009;border-right:1px solid #2a1f18;display:flex;flex-direction:column;overflow:hidden;}
  .crm-sidebar-header{padding:12px 14px;border-bottom:1px solid #2a1f18;display:flex;flex-direction:column;gap:8px;}
  .crm-back-btn{background:transparent;border:none;color:#7a6e5e;font-size:12px;cursor:pointer;text-align:left;padding:2px 0;font-family:inherit;transition:color .2s;}
  .crm-back-btn:hover{color:#c2904d;}
  .crm-filtros{display:flex;gap:4px;flex-wrap:wrap;}
  .crm-filtro-btn{padding:3px 9px;font-size:11px;background:#1a170f;border:1px solid #2a1f18;border-radius:6px;color:#7a6e5e;cursor:pointer;font-family:inherit;transition:all .15s;}
  .crm-filtro-btn:hover{color:#fff9e6;border-color:#3a2e20;}
  .crm-filtro-ativo{background:#c2904d18;border-color:#c2904d44;color:#c2904d !important;}
  .crm-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
  .crm-list::-webkit-scrollbar{width:4px;}
  .crm-list::-webkit-scrollbar-thumb{background:#2a1f18;border-radius:2px;}
  .crm-loading,.crm-vazio{padding:20px;font-size:13px;color:#4a3e30;text-align:center;}
  .crm-conv-item{display:flex;gap:10px;padding:11px 14px;border:none;background:transparent;cursor:pointer;text-align:left;border-bottom:1px solid #1e1a14;transition:background .15s;width:100%;}
  .crm-conv-item:hover{background:#1a170f;}
  .crm-conv-ativo{background:#c2904d0d !important;border-left:2px solid #c2904d;}
  .crm-conv-avatar{width:36px;height:36px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff9e6;flex-shrink:0;}
  .crm-conv-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
  .crm-conv-top{display:flex;justify-content:space-between;align-items:center;}
  .crm-conv-nome{font-size:13px;font-weight:600;color:#fff9e6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .crm-conv-time{font-size:10px;color:#4a3e30;flex-shrink:0;}
  .crm-conv-preview{font-size:11px;color:#5a4e40;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .crm-conv-badges{display:flex;gap:5px;align-items:center;}
  .crm-etq-badge{font-size:9px;padding:1px 6px;border-radius:4px;font-weight:600;}
  .crm-qs-badge{font-size:9px;font-weight:700;}

  /* Main chat */
  .crm-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
  .crm-placeholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#3a3028;}
  .crm-placeholder-icon{font-size:48px;opacity:.3;}
  .crm-placeholder-sub{font-size:12px;color:#2a2218;}
  .crm-chat-header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #2a1f18;flex-shrink:0;background:#111009;}
  .crm-chat-avatar{width:36px;height:36px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff9e6;flex-shrink:0;}
  .crm-chat-info{display:flex;flex-direction:column;flex:1;min-width:0;}
  .crm-chat-nome{font-size:14px;font-weight:600;color:#fff9e6;}
  .crm-chat-phone{font-size:11px;color:#5a4e40;}
  .crm-chat-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
  .crm-action-btn{padding:4px 10px;font-size:11px;border-radius:6px;border:1px solid;cursor:pointer;font-family:inherit;transition:all .15s;}
  .crm-btn-ia{background:#6acca015;border-color:#6acca044;color:#6acca0;}
  .crm-btn-ia:hover{background:#6acca025;}
  .crm-btn-human{background:#c2904d15;border-color:#c2904d44;color:#c2904d;}
  .crm-btn-human:hover{background:#c2904d25;}
  .crm-agendados-badge{background:#a07ae015;border:1px solid #a07ae044;color:#a07ae0;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit;}
  .crm-etiqueta-wrap{position:relative;}
  .crm-etiqueta-select{padding:4px 10px;font-size:11px;border-radius:6px;border:1px solid;cursor:pointer;font-family:inherit;background:transparent;}
  .crm-etiqueta-dropdown{position:absolute;right:0;top:calc(100% + 6px);background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:4px;z-index:100;min-width:170px;box-shadow:0 8px 24px #00000060;}
  .crm-etiqueta-opt{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;background:transparent;border:none;cursor:pointer;font-size:12px;color:#c8b99a;font-family:inherit;border-radius:5px;transition:background .15s;}
  .crm-etiqueta-opt:hover{background:#1e1a14;}
  .et-ativo{background:#c2904d15 !important;}
  .et-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .crm-perfil-toggle{width:28px;height:28px;border-radius:6px;border:1px solid #2a1f18;background:transparent;color:#5a4e40;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .crm-perfil-toggle:hover{border-color:#c2904d44;color:#c2904d;}

  /* Messages */
  .crm-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:4px;}
  .crm-msgs::-webkit-scrollbar{width:4px;}
  .crm-msgs::-webkit-scrollbar-thumb{background:#2a1f18;border-radius:2px;}
  .crm-msgs-loading,.crm-msgs-vazio{text-align:center;color:#3a3028;font-size:13px;margin:auto;}
  .crm-data-sep{text-align:center;margin:8px 0;}
  .crm-data-sep span{font-size:11px;color:#3a3028;background:#1a170f;padding:3px 10px;border-radius:10px;}
  .crm-bubble-wrap{display:flex;}
  .wrap-bot{justify-content:flex-start;}
  .wrap-user{justify-content:flex-end;}
  .crm-bubble{max-width:72%;padding:9px 13px;border-radius:12px;display:flex;flex-direction:column;gap:4px;}
  .bubble-bot{background:#1a1710;border:1px solid #2a1f18;border-bottom-left-radius:3px;}
  .bubble-user{background:#c2904d20;border:1px solid #c2904d33;border-bottom-right-radius:3px;}
  .crm-bubble-text{font-size:13px;color:#e8dcc8;line-height:1.5;white-space:pre-wrap;word-break:break-word;}
  .crm-bubble-hora{font-size:10px;color:#4a3e30;text-align:right;}

  /* Input area */
  .crm-input-area{border-top:1px solid #2a1f18;padding:10px 14px;background:#111009;display:flex;flex-direction:column;gap:6px;flex-shrink:0;}
  .crm-envio-erro{font-size:12px;color:#e07070;background:#e0707015;padding:6px 10px;border-radius:6px;}
  .crm-file-preview{display:flex;align-items:center;justify-content:space-between;background:#1a170f;border:1px solid #2a1f18;border-radius:8px;padding:7px 10px;}
  .crm-file-info{display:flex;gap:8px;align-items:center;}
  .crm-file-type{font-size:11px;font-weight:600;color:#c2904d;background:#c2904d15;padding:2px 6px;border-radius:4px;}
  .crm-file-name{font-size:12px;color:#c8b99a;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .crm-file-size{font-size:11px;color:#5a4e40;}
  .crm-file-remove{background:transparent;border:none;color:#5a4e40;cursor:pointer;font-size:14px;padding:0 4px;}
  .crm-rec-bar{display:flex;align-items:center;gap:10px;background:#e070700d;border:1px solid #e0707033;border-radius:8px;padding:8px 12px;}
  .crm-rec-dot{width:8px;height:8px;border-radius:50%;background:#e07070;animation:blink 1s infinite;}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
  .crm-rec-time{font-size:14px;font-weight:700;color:#e07070;font-variant-numeric:tabular-nums;min-width:38px;}
  .crm-rec-label{font-size:12px;color:#c8b99a;flex:1;}
  .crm-rec-cancel,.crm-rec-stop{padding:4px 10px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-family:inherit;}
  .crm-rec-cancel{background:#2a1f18;color:#7a6e5e;}
  .crm-rec-stop{background:#e07070;color:#fff;}
  .crm-agendar-box{background:#1a170f;border:1px solid #2a1f18;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;}
  .crm-agendar-header{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;color:#c8b99a;}
  .crm-agendar-row{display:flex;gap:8px;}
  .crm-agendar-input{flex:1;background:#0e0f09;border:1px solid #2a1f18;border-radius:7px;padding:7px 10px;font-size:12px;color:#c8b99a;font-family:inherit;outline:none;}
  .crm-agendar-input:focus{border-color:#c2904d55;}
  .crm-agendar-btn{padding:7px 14px;background:#c2904d;border:none;border-radius:7px;color:#0e0f09;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}
  .crm-agendar-btn:disabled{opacity:.5;cursor:default;}
  .crm-agendar-text{width:100%;background:#0e0f09;border:1px solid #2a1f18;border-radius:7px;padding:8px 10px;font-size:12px;color:#c8b99a;font-family:inherit;resize:none;outline:none;}
  .crm-agendar-tpls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
  .crm-agendar-tpls-label{font-size:11px;color:#5a4e40;}
  .crm-agendar-tpl-btn{font-size:11px;padding:3px 8px;background:#1e1a14;border:1px solid #2a1f18;border-radius:5px;color:#c8b99a;cursor:pointer;font-family:inherit;}
  .crm-agendar-tpl-btn:hover{border-color:#c2904d55;color:#c2904d;}
  .crm-salvar-tpl-box{display:flex;gap:6px;align-items:center;}
  .crm-salvar-tpl-input{flex:1;background:#1a170f;border:1px solid #2a1f18;border-radius:7px;padding:7px 10px;font-size:12px;color:#c8b99a;font-family:inherit;outline:none;}
  .crm-salvar-tpl-btn{padding:7px 12px;background:#c2904d;border:none;border-radius:7px;color:#0e0f09;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}
  .crm-salvar-tpl-btn:disabled{opacity:.5;}
  .crm-salvar-tpl-cancel{padding:7px 10px;background:transparent;border:none;color:#5a4e40;cursor:pointer;font-size:12px;font-family:inherit;}
  .crm-toolbar{display:flex;align-items:center;gap:2px;}
  .crm-tool-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;background:transparent;border:none;cursor:pointer;border-radius:6px;transition:background .15s;}
  .crm-tool-btn:hover{background:#2a1f18;}
  .crm-tool-sep{width:1px;height:20px;background:#2a1f18;margin:0 4px;}
  .crm-tool-save{opacity:.7;}
  .crm-tpl-wrap{position:relative;}
  .crm-tpl-dropdown{position:absolute;bottom:calc(100% + 8px);left:0;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:4px;z-index:100;min-width:260px;max-height:280px;overflow-y:auto;box-shadow:0 8px 24px #00000070;}
  .crm-tpl-header{font-size:11px;font-weight:600;color:#5a4e40;padding:6px 10px;text-transform:uppercase;letter-spacing:.5px;}
  .crm-tpl-vazio{font-size:12px;color:#4a3e30;padding:10px;}
  .crm-tpl-item{display:flex;align-items:stretch;border-radius:7px;overflow:hidden;margin-bottom:2px;}
  .crm-tpl-use{flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 10px;background:transparent;border:none;cursor:pointer;text-align:left;border-radius:7px;transition:background .15s;}
  .crm-tpl-use:hover{background:#1e1a14;}
  .crm-tpl-nome{font-size:12px;font-weight:600;color:#c8b99a;}
  .crm-tpl-prev{font-size:11px;color:#5a4e40;}
  .crm-tpl-del{background:transparent;border:none;color:#3a3028;cursor:pointer;padding:0 8px;font-size:13px;transition:color .15s;}
  .crm-tpl-del:hover{color:#e07070;}
  .crm-input-row{display:flex;gap:8px;align-items:flex-end;}
  .crm-textarea{flex:1;background:#1a170f;border:1px solid #2a1f18;border-radius:8px;padding:9px 12px;font-size:13px;color:#fff9e6;font-family:inherit;resize:none;outline:none;transition:border-color .2s;max-height:120px;min-height:38px;}
  .crm-textarea:focus{border-color:#c2904d44;}
  .crm-send-btn{width:38px;height:38px;background:#c2904d;border:none;border-radius:8px;color:#0e0f09;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;transition:background .15s;}
  .crm-send-btn:hover:not(:disabled){background:#d4a05d;}
  .crm-send-btn:disabled{opacity:.4;cursor:default;}
  .crm-mic-btn{width:38px;height:38px;background:#1e1a12;border:1px solid #2a1f18;border-radius:8px;color:#7a6e5e;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,color .15s;}
  .crm-mic-btn:hover{background:#2a1f18;color:#c2904d;}
  .crm-input-hint{font-size:10px;color:#2a2218;text-align:center;}

  /* Overlays */
  .crm-panel-overlay{position:absolute;top:52px;right:0;left:0;z-index:50;display:flex;justify-content:center;padding-top:80px;pointer-events:none;}
  .crm-panel{background:#111009;border:1px solid #2a1f18;border-radius:12px;padding:0;min-width:340px;max-width:420px;box-shadow:0 12px 40px #00000080;pointer-events:all;}
  .crm-panel-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #1e1a14;}
  .crm-panel-title{font-size:13px;font-weight:600;color:#c8b99a;}
  .crm-panel-close{background:transparent;border:none;color:#5a4e40;font-size:16px;cursor:pointer;padding:0 2px;}
  .crm-panel-vazio{padding:16px;font-size:13px;color:#4a3e30;}
  .crm-panel-list{display:flex;flex-direction:column;gap:0;max-height:280px;overflow-y:auto;}
  .crm-agend-item{padding:12px 16px;border-bottom:1px solid #1e1a14;}
  .crm-agend-texto{font-size:13px;color:#c8b99a;margin-bottom:6px;line-height:1.4;}
  .crm-agend-meta{display:flex;justify-content:space-between;align-items:center;}
  .crm-agend-data{font-size:11px;color:#7a6e5e;}
  .crm-agend-cancel{background:transparent;border:1px solid #e0707044;color:#e07070;border-radius:5px;padding:3px 9px;font-size:11px;cursor:pointer;font-family:inherit;}

  /* ── Lead Sidebar (perfil) ── */
  .ls-root{width:280px;flex-shrink:0;background:#0c0d09;border-left:1px solid #2a1f18;display:flex;flex-direction:column;overflow-y:auto;gap:0;}
  .ls-root::-webkit-scrollbar{width:4px;}
  .ls-root::-webkit-scrollbar-thumb{background:#2a1f18;border-radius:2px;}
  .ls-loading{padding:20px;text-align:center;color:#3a3028;font-size:13px;}

  /* Score gauge */
  .ls-gauge-section{display:flex;flex-direction:column;align-items:center;padding:20px 16px 14px;border-bottom:1px solid #1e1a14;gap:8px;}
  .ls-gauge-wrap{position:relative;width:90px;height:90px;}
  .ls-gauge{width:90px;height:90px;border-radius:50%;display:flex;align-items:center;justify-content:center;}
  .ls-gauge-inner{position:absolute;inset:8px;background:#0c0d09;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .ls-gauge-num{font-size:22px;font-weight:800;color:#fff9e6;font-family:'Cormorant Garamond',Georgia,serif;line-height:1;}
  .ls-gauge-sub{font-size:10px;color:#5a4e40;}
  .ls-nivel-badge{font-size:11px;font-weight:600;color:#c2904d;background:#c2904d15;padding:3px 10px;border-radius:10px;}
  .ls-temp-badge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:10px;border:1px solid;}

  /* Info rows */
  .ls-info{padding:10px 14px;border-bottom:1px solid #1e1a14;display:flex;flex-direction:column;gap:5px;}
  .ls-info-row{display:flex;align-items:flex-start;gap:7px;}
  .ls-info-icon{font-size:12px;flex-shrink:0;margin-top:1px;}
  .ls-info-val{font-size:11px;color:#8a7e6e;line-height:1.4;word-break:break-all;}
  .ls-truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;word-break:normal;}

  /* Sections */
  .ls-section{padding:12px 14px;border-bottom:1px solid #1e1a14;}
  .ls-section-label{font-size:9px;font-weight:700;color:#4a3e30;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;}

  /* Pipeline buttons */
  .ls-pipeline-grid{display:flex;flex-direction:column;gap:3px;}
  .ls-pipeline-btn{display:flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid #2a1f18;border-radius:6px;background:transparent;color:#5a4e40;font-size:11px;cursor:pointer;font-family:inherit;text-align:left;transition:all .15s;}
  .ls-pipeline-btn:hover{border-color:#3a2e20;color:#c8b99a;}
  .ls-pipeline-ativo{font-weight:600;}

  /* Pillar bars */
  .ls-pilar-row{display:flex;align-items:center;gap:8px;margin-bottom:5px;}
  .ls-pilar-nome{font-size:10px;color:#7a6e5e;width:82px;flex-shrink:0;}
  .ls-pilar-bar{flex:1;height:4px;background:#1e1a14;border-radius:2px;overflow:hidden;}
  .ls-pilar-fill{height:100%;border-radius:2px;transition:width .4s;}
  .ls-pilar-num{font-size:10px;font-weight:700;width:18px;text-align:right;flex-shrink:0;}

  /* Qualificações */
  .ls-qual-row{display:flex;flex-direction:column;gap:2px;margin-bottom:7px;background:#0e0f09;border:1px solid #1e1a14;border-radius:6px;padding:7px 9px;}
  .ls-qual-campo{font-size:9px;font-weight:700;color:#c2904d;text-transform:uppercase;letter-spacing:.5px;}
  .ls-qual-valor{font-size:11px;color:#c8b99a;line-height:1.4;}

  /* Notas */
  .ls-notas-section{flex:1;}
  .ls-notas{width:100%;background:#0e0f09;border:1px solid #2a1f18;border-radius:8px;padding:9px 10px;font-size:12px;color:#c8b99a;font-family:inherit;resize:none;outline:none;min-height:80px;transition:border-color .2s;box-sizing:border-box;}
  .ls-notas:focus{border-color:#c2904d44;}
  .ls-notas::placeholder{color:#3a3028;}
`;

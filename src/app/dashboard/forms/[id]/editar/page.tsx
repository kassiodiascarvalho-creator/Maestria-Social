"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";

type TipoQ = "nome" | "email" | "whatsapp" | "texto_curto" | "texto_longo"
  | "multipla_escolha" | "pontuacao" | "sim_nao" | "data" | "upload";

interface Pergunta {
  id: string;
  tipo: TipoQ;
  label: string;
  descricao?: string;
  placeholder?: string;
  opcoes?: string[];
  obrigatorio: boolean;
  ordem: number;
}

interface Form {
  id: string;
  slug: string;
  titulo: string;
  descricao?: string;
  status: string;
  modo_exibicao: string;
  config: {
    cor_fundo: string;
    cor_texto: string;
    cor_botao: string;
    cor_texto_botao: string;
    arredondamento: number;
    fonte: string;
    alinhamento: string;
    imagem_fundo?: string;
    imagem_posicao_x?: string;
    imagem_posicao_y?: string;
    overlay_opacidade?: number;
    logo_url?: string;
    mensagem_obrigado?: string;
    barra_estilo?: string;
    pixel_facebook?: string;
    gtm_id?: string;
    ga_id?: string;
  };
  envio_email?: string;
  envio_whatsapp?: string;
  webhook_url?: string;
}

const TIPOS: { tipo: TipoQ; label: string; icon: string }[] = [
  { tipo: "nome",           label: "Nome",            icon: "◉" },
  { tipo: "email",          label: "E-mail",          icon: "◈" },
  { tipo: "whatsapp",       label: "WhatsApp",        icon: "◎" },
  { tipo: "texto_curto",    label: "Texto Curto",     icon: "◧" },
  { tipo: "texto_longo",    label: "Texto Longo",     icon: "◫" },
  { tipo: "multipla_escolha", label: "Múltipla Escolha", icon: "◑" },
  { tipo: "pontuacao",      label: "Pontuação",       icon: "◷" },
  { tipo: "sim_nao",        label: "Sim / Não",       icon: "◇" },
  { tipo: "data",           label: "Data",            icon: "◈" },
];

const FONTES = ["Inter", "Georgia", "Verdana", "Trebuchet MS", "Courier New"];

export default function EditarFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [form, setForm] = useState<Form | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"perguntas" | "design" | "config">("perguntas");
  const [editandoQ, setEditandoQ] = useState<string | null>(null);
  const [addTipo, setAddTipo] = useState<TipoQ>("texto_curto");
  const [uploadandoImg, setUploadandoImg] = useState(false);
  const [uploadandoLogo, setUploadandoLogo] = useState(false);

  const carregar = async () => {
    const [fRes, pRes] = await Promise.all([
      fetch(`/api/admin/forms/${id}`),
      fetch(`/api/admin/forms/${id}/perguntas`),
    ]);
    const [f, p] = await Promise.all([fRes.json(), pRes.json()]);
    setForm(f);
    setPerguntas(Array.isArray(p) ? p : []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [id]);

  const salvarForm = async () => {
    if (!form) return;
    setSalvando(true);
    await fetch(`/api/admin/forms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: form.titulo, descricao: form.descricao,
        status: form.status, modo_exibicao: form.modo_exibicao,
        config: form.config, envio_email: form.envio_email,
        envio_whatsapp: form.envio_whatsapp, webhook_url: form.webhook_url,
      }),
    });
    setSalvando(false);
  };

  const adicionarPergunta = async () => {
    const labelDefault: Record<TipoQ, string> = {
      nome: "Qual é o seu nome?", email: "Qual é o seu e-mail?",
      whatsapp: "Qual é o seu WhatsApp?", texto_curto: "Nova pergunta",
      texto_longo: "Descreva com detalhes", multipla_escolha: "Escolha uma opção",
      pontuacao: "De 1 a 10, como você avalia?", sim_nao: "Você concorda?",
      data: "Qual data?", upload: "Envie um arquivo",
    };
    const novaOrdem = perguntas.length > 0 ? Math.max(...perguntas.map(p => p.ordem)) + 1 : 0;
    const body: Record<string, unknown> = {
      tipo: addTipo, label: labelDefault[addTipo], obrigatorio: true, ordem: novaOrdem,
    };
    if (addTipo === "multipla_escolha") body.opcoes = ["Opção 1", "Opção 2", "Opção 3"];
    if (addTipo === "pontuacao") body.opcoes = Array.from({ length: 10 }, (_, i) => String(i + 1));

    const r = await fetch(`/api/admin/forms/${id}/perguntas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const nova = await r.json();
    setPerguntas(prev => [...prev, nova]);
    setEditandoQ(nova.id);
  };

  const atualizarPergunta = async (qId: string, campos: Partial<Pergunta>) => {
    await fetch(`/api/admin/forms/${id}/perguntas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: qId, ...campos }),
    });
    setPerguntas(prev => prev.map(p => p.id === qId ? { ...p, ...campos } : p));
  };

  const deletarPergunta = async (qId: string) => {
    if (!confirm("Remover esta pergunta?")) return;
    await fetch(`/api/admin/forms/${id}/perguntas?question_id=${qId}`, { method: "DELETE" });
    setPerguntas(prev => prev.filter(p => p.id !== qId));
    if (editandoQ === qId) setEditandoQ(null);
  };

  const moverPergunta = async (idx: number, dir: -1 | 1) => {
    const newArr = [...perguntas];
    const target = idx + dir;
    if (target < 0 || target >= newArr.length) return;
    [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
    const reordenado = newArr.map((p, i) => ({ ...p, ordem: i }));
    setPerguntas(reordenado);
    await fetch(`/api/admin/forms/${id}/perguntas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reordenado.map(p => ({ id: p.id, ordem: p.ordem }))),
    });
  };

  if (loading) {
    return <div style={{ color: "#6b7280", textAlign: "center", padding: 80 }}>Carregando...</div>;
  }
  if (!form) {
    return <div style={{ color: "#ef4444", textAlign: "center", padding: 80 }}>Formulário não encontrado.</div>;
  }

  const cfg = form.config;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0a" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "14px 24px", background: "#111",
        borderBottom: "1px solid #1e1e1e", flexShrink: 0,
        flexWrap: "wrap",
      }}>
        <Link href="/dashboard/forms" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>
          ← Formulários
        </Link>
        <div style={{ flex: 1 }}>
          <input
            value={form.titulo}
            onChange={e => setForm(f => f ? { ...f, titulo: e.target.value } : f)}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "#fff", fontSize: 17, fontWeight: 700, fontFamily: "inherit",
              width: "100%", maxWidth: 400,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={form.status}
            onChange={e => setForm(f => f ? { ...f, status: e.target.value } : f)}
            style={{
              background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff",
              borderRadius: 7, padding: "6px 10px", fontSize: 13, fontFamily: "inherit",
            }}
          >
            <option value="rascunho">Rascunho</option>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
          </select>
          <a
            href={`/f/${form.slug}`} target="_blank" rel="noreferrer"
            style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}
          >
            Ver ↗
          </a>
          <button
            onClick={salvarForm} disabled={salvando}
            style={{
              background: "#c2a44a", color: "#0d0d0d", border: "none",
              borderRadius: 7, padding: "8px 18px", fontWeight: 700,
              fontSize: 13, cursor: "pointer", opacity: salvando ? 0.6 : 1,
            }}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div style={{
        display: "flex", gap: 4, padding: "10px 24px",
        background: "#0f0f0f", borderBottom: "1px solid #1a1a1a", flexShrink: 0,
      }}>
        {(["perguntas", "design", "config"] as const).map(a => (
          <button key={a} onClick={() => setAba(a)} style={{
            background: aba === a ? "#1a1a1a" : "transparent",
            border: `1px solid ${aba === a ? "#2a2a2a" : "transparent"}`,
            color: aba === a ? "#fff" : "#6b7280",
            borderRadius: 7, padding: "6px 16px", fontSize: 13,
            cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
            textTransform: "capitalize",
          }}>
            {a === "perguntas" ? "Perguntas" : a === "design" ? "Design" : "Configurações"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto" }}>

        {/* ── ABA PERGUNTAS ── */}
        {aba === "perguntas" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0, height: "100%" }}>
            {/* Lista de perguntas */}
            <div style={{ padding: "24px 24px 80px", overflow: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {perguntas.map((p, idx) => (
                  <div key={p.id}>
                    <div
                      onClick={() => setEditandoQ(editandoQ === p.id ? null : p.id)}
                      style={{
                        background: editandoQ === p.id ? "#161616" : "#111",
                        border: `1px solid ${editandoQ === p.id ? "#c2a44a40" : "#1e1e1e"}`,
                        borderRadius: 12, padding: "14px 18px",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                      }}
                    >
                      <span style={{ color: "#c2a44a", fontSize: 13, fontWeight: 700, minWidth: 22 }}>
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{p.label}</div>
                        <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>
                          {TIPOS.find(t => t.tipo === p.tipo)?.label} {p.obrigatorio ? "· Obrigatório" : "· Opcional"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); moverPergunta(idx, -1); }}
                          style={iconBtn} disabled={idx === 0}>↑</button>
                        <button onClick={(e) => { e.stopPropagation(); moverPergunta(idx, 1); }}
                          style={iconBtn} disabled={idx === perguntas.length - 1}>↓</button>
                        <button onClick={(e) => { e.stopPropagation(); deletarPergunta(p.id); }}
                          style={{ ...iconBtn, color: "#ef4444" }}>✕</button>
                      </div>
                    </div>

                    {/* Edição inline */}
                    {editandoQ === p.id && (
                      <div style={{
                        background: "#0d0d0d", border: "1px solid #1e1e1e",
                        borderTop: "none", borderRadius: "0 0 12px 12px",
                        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12,
                      }}>
                        <div>
                          <label style={labelStyle}>Pergunta</label>
                          <input
                            value={p.label}
                            onChange={e => setPerguntas(prev => prev.map(q => q.id === p.id ? { ...q, label: e.target.value } : q))}
                            onBlur={() => atualizarPergunta(p.id, { label: p.label })}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Descrição (opcional)</label>
                          <input
                            value={p.descricao ?? ""}
                            onChange={e => setPerguntas(prev => prev.map(q => q.id === p.id ? { ...q, descricao: e.target.value } : q))}
                            onBlur={() => atualizarPergunta(p.id, { descricao: p.descricao })}
                            style={inputStyle}
                            placeholder="Texto auxiliar abaixo da pergunta"
                          />
                        </div>
                        {(p.tipo === "texto_curto" || p.tipo === "nome" || p.tipo === "email" || p.tipo === "whatsapp") && (
                          <div>
                            <label style={labelStyle}>Placeholder</label>
                            <input
                              value={p.placeholder ?? ""}
                              onChange={e => setPerguntas(prev => prev.map(q => q.id === p.id ? { ...q, placeholder: e.target.value } : q))}
                              onBlur={() => atualizarPergunta(p.id, { placeholder: p.placeholder })}
                              style={inputStyle}
                            />
                          </div>
                        )}
                        {p.tipo === "multipla_escolha" && (
                          <div>
                            <label style={labelStyle}>Opções (uma por linha)</label>
                            <textarea
                              value={(p.opcoes ?? []).join("\n")}
                              onChange={e => {
                                const novas = e.target.value.split("\n");
                                setPerguntas(prev => prev.map(q => q.id === p.id ? { ...q, opcoes: novas } : q));
                              }}
                              onBlur={() => atualizarPergunta(p.id, { opcoes: p.opcoes })}
                              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                            />
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <label style={{ ...labelStyle, marginBottom: 0 }}>Obrigatório</label>
                          <input
                            type="checkbox"
                            checked={p.obrigatorio}
                            onChange={e => {
                              const v = e.target.checked;
                              setPerguntas(prev => prev.map(q => q.id === p.id ? { ...q, obrigatorio: v } : q));
                              atualizarPergunta(p.id, { obrigatorio: v });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {perguntas.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#4b5563" }}>
                  Nenhuma pergunta ainda. Adicione pelo painel →
                </div>
              )}
            </div>

            {/* Painel adicionar pergunta */}
            <div style={{
              borderLeft: "1px solid #1a1a1a", padding: 20,
              background: "#0f0f0f", overflow: "auto",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                Adicionar Pergunta
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {TIPOS.map(t => (
                  <button
                    key={t.tipo}
                    onClick={() => setAddTipo(t.tipo)}
                    style={{
                      background: addTipo === t.tipo ? "#c2a44a18" : "transparent",
                      border: `1px solid ${addTipo === t.tipo ? "#c2a44a40" : "#1e1e1e"}`,
                      color: addTipo === t.tipo ? "#c2a44a" : "#9ca3af",
                      borderRadius: 8, padding: "8px 12px", textAlign: "left",
                      cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={adicionarPergunta}
                style={{
                  width: "100%", background: "#c2a44a", color: "#0d0d0d",
                  border: "none", borderRadius: 8, padding: "11px",
                  fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                + Adicionar
              </button>

              {/* Modo exibição */}
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #1a1a1a" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
                  Modo de Exibição
                </div>
                {["uma_por_vez", "todas_de_uma"].map(m => (
                  <button
                    key={m}
                    onClick={() => setForm(f => f ? { ...f, modo_exibicao: m } : f)}
                    style={{
                      display: "block", width: "100%", marginBottom: 8,
                      background: form.modo_exibicao === m ? "#c2a44a18" : "transparent",
                      border: `1px solid ${form.modo_exibicao === m ? "#c2a44a40" : "#1e1e1e"}`,
                      color: form.modo_exibicao === m ? "#c2a44a" : "#6b7280",
                      borderRadius: 8, padding: "9px 12px", textAlign: "left",
                      cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                    }}
                  >
                    {m === "uma_por_vez" ? "Uma por vez (Typeform)" : "Todas de uma vez"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA DESIGN ── */}
        {aba === "design" && (
          <div style={{ padding: "28px 32px", maxWidth: 600 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Row label="Cor de fundo">
                <input type="color" value={cfg.cor_fundo} onChange={e => setForm(f => f ? { ...f, config: { ...f.config, cor_fundo: e.target.value } } : f)} style={colorInput} />
                <span style={{ color: "#6b7280", fontSize: 13 }}>{cfg.cor_fundo}</span>
              </Row>
              <Row label="Cor do texto">
                <input type="color" value={cfg.cor_texto} onChange={e => setForm(f => f ? { ...f, config: { ...f.config, cor_texto: e.target.value } } : f)} style={colorInput} />
              </Row>
              <Row label="Cor do botão OK">
                <input type="color" value={cfg.cor_botao} onChange={e => setForm(f => f ? { ...f, config: { ...f.config, cor_botao: e.target.value } } : f)} style={colorInput} />
              </Row>
              <Row label="Cor do texto do botão">
                <input type="color" value={cfg.cor_texto_botao} onChange={e => setForm(f => f ? { ...f, config: { ...f.config, cor_texto_botao: e.target.value } } : f)} style={colorInput} />
              </Row>
              <Row label="Arredondamento (px)">
                <input type="range" min={0} max={32} value={cfg.arredondamento}
                  onChange={e => setForm(f => f ? { ...f, config: { ...f.config, arredondamento: Number(e.target.value) } } : f)}
                  style={{ width: 140 }}
                />
                <span style={{ color: "#6b7280", fontSize: 13 }}>{cfg.arredondamento}px</span>
              </Row>
              <Row label="Fonte">
                <select value={cfg.fonte}
                  onChange={e => setForm(f => f ? { ...f, config: { ...f.config, fonte: e.target.value } } : f)}
                  style={{ ...inputStyle, width: "auto", padding: "6px 12px" }}>
                  {FONTES.map(fn => <option key={fn}>{fn}</option>)}
                </select>
              </Row>
              <Row label="Alinhamento">
                {["left", "center"].map(a => (
                  <button key={a} onClick={() => setForm(f => f ? { ...f, config: { ...f.config, alinhamento: a } } : f)}
                    style={{
                      background: cfg.alinhamento === a ? "#c2a44a" : "#1a1a1a",
                      color: cfg.alinhamento === a ? "#0d0d0d" : "#6b7280",
                      border: "1px solid #2a2a2a", borderRadius: 6,
                      padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                    }}>
                    {a === "left" ? "Esquerda" : "Centro"}
                  </button>
                ))}
              </Row>
              <Row label="Imagem de fundo">
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input value={cfg.imagem_fundo ?? ""}
                      onChange={e => setForm(f => f ? { ...f, config: { ...f.config, imagem_fundo: e.target.value } } : f)}
                      placeholder="https://..." style={{ ...inputStyle, flex: 1 }} />
                    <label style={{
                      background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#9ca3af",
                      borderRadius: 7, padding: "8px 12px", fontSize: 12, cursor: "pointer",
                      whiteSpace: "nowrap", opacity: uploadandoImg ? 0.5 : 1,
                    }}>
                      {uploadandoImg ? "Enviando..." : "↑ Upload"}
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        disabled={uploadandoImg}
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadandoImg(true);
                          const fd = new FormData();
                          fd.append("form_id", id);
                          fd.append("file", file);
                          const r = await fetch("/api/admin/forms/upload", { method: "POST", body: fd });
                          const d = await r.json();
                          if (d.url) setForm(f => f ? { ...f, config: { ...f.config, imagem_fundo: d.url } } : f);
                          setUploadandoImg(false);
                        }}
                      />
                    </label>
                  </div>
                  {cfg.imagem_fundo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cfg.imagem_fundo} alt="preview" style={{ width: 120, height: 68, objectFit: "cover", borderRadius: 6, border: "1px solid #2a2a2a" }} />
                  )}
                </div>
              </Row>
              <Row label="Logo">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                  <input value={cfg.logo_url ?? ""}
                    onChange={e => setForm(f => f ? { ...f, config: { ...f.config, logo_url: e.target.value } } : f)}
                    placeholder="https://..." style={{ ...inputStyle, flex: 1 }} />
                  <label style={{
                    background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#9ca3af",
                    borderRadius: 7, padding: "8px 12px", fontSize: 12, cursor: "pointer",
                    whiteSpace: "nowrap", opacity: uploadandoLogo ? 0.5 : 1,
                  }}>
                    {uploadandoLogo ? "Enviando..." : "↑ Upload"}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      disabled={uploadandoLogo}
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadandoLogo(true);
                        const fd = new FormData();
                        fd.append("form_id", `${id}-logo`);
                        fd.append("file", file);
                        const r = await fetch("/api/admin/forms/upload", { method: "POST", body: fd });
                        const d = await r.json();
                        if (d.url) setForm(f => f ? { ...f, config: { ...f.config, logo_url: d.url } } : f);
                        setUploadandoLogo(false);
                      }}
                    />
                  </label>
                </div>
              </Row>
              <div>
                <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 10 }}>Posição da imagem</div>
                <PhoneMockup
                  imageUrl={cfg.imagem_fundo ?? ""}
                  posX={cfg.imagem_posicao_x ?? "50%"}
                  posY={cfg.imagem_posicao_y ?? "50%"}
                  onChange={(x, y) => setForm(f => f ? { ...f, config: { ...f.config, imagem_posicao_x: x, imagem_posicao_y: y } } : f)}
                />
              </div>
              <Row label="Escurecimento da imagem">
                <input type="range" min={0} max={95} value={cfg.overlay_opacidade ?? 55}
                  onChange={e => setForm(f => f ? { ...f, config: { ...f.config, overlay_opacidade: Number(e.target.value) } } : f)}
                  style={{ width: 160 }} />
                <span style={{ color: "#6b7280", fontSize: 13, minWidth: 30 }}>{cfg.overlay_opacidade ?? 55}%</span>
                <span style={{ color: "#4b5563", fontSize: 12 }}>(0 = sem escurecer, 95 = quase preto)</span>
              </Row>
              <Row label="Barra de progresso">
                {([["solida","Sólida"],["pontilhada","Pontilhada"],["tracejada","Tracejada"],["oculta","Ocultar"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setForm(f => f ? { ...f, config: { ...f.config, barra_estilo: v } } : f)}
                    style={{ background: (cfg.barra_estilo ?? "solida") === v ? "#c2a44a" : "#1a1a1a", color: (cfg.barra_estilo ?? "solida") === v ? "#0d0d0d" : "#6b7280", border: "1px solid #2a2a2a", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                    {l}
                  </button>
                ))}
              </Row>
              <Row label="Mensagem de obrigado">
                <textarea value={cfg.mensagem_obrigado ?? ""}
                  onChange={e => setForm(f => f ? { ...f, config: { ...f.config, mensagem_obrigado: e.target.value } } : f)}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical", width: 300 }}
                  placeholder="Suas respostas foram recebidas..." />
              </Row>
            </div>
            <button onClick={salvarForm} disabled={salvando} style={{
              marginTop: 32, background: "#c2a44a", color: "#0d0d0d", border: "none",
              borderRadius: 8, padding: "12px 28px", fontWeight: 700, fontSize: 15,
              cursor: "pointer", opacity: salvando ? 0.6 : 1,
            }}>
              {salvando ? "Salvando..." : "Salvar Design"}
            </button>
          </div>
        )}

        {/* ── ABA CONFIG ── */}
        {aba === "config" && (
          <div style={{ padding: "28px 32px", maxWidth: 560 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={labelStyle}>Descrição do formulário</label>
                <textarea
                  value={form.descricao ?? ""}
                  onChange={e => setForm(f => f ? { ...f, descricao: e.target.value } : f)}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  placeholder="Descrição exibida no formulário..."
                />
              </div>
              <div>
                <label style={labelStyle}>Notificação WhatsApp (número)</label>
                <input
                  value={form.envio_whatsapp ?? ""}
                  onChange={e => setForm(f => f ? { ...f, envio_whatsapp: e.target.value } : f)}
                  placeholder="5511999999999"
                  style={inputStyle}
                />
                <div style={{ color: "#4b5563", fontSize: 12, marginTop: 4 }}>
                  Receba um WhatsApp a cada nova resposta.
                </div>
              </div>
              <div>
                <label style={labelStyle}>E-mail de notificação</label>
                <input
                  value={form.envio_email ?? ""}
                  onChange={e => setForm(f => f ? { ...f, envio_email: e.target.value } : f)}
                  placeholder="seu@email.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Webhook URL</label>
                <input
                  value={form.webhook_url ?? ""}
                  onChange={e => setForm(f => f ? { ...f, webhook_url: e.target.value } : f)}
                  placeholder="https://webhook.site/..."
                  style={inputStyle}
                />
                <div style={{ color: "#4b5563", fontSize: 12, marginTop: 4 }}>
                  Chamado via POST a cada resposta com todos os dados.
                </div>
              </div>
              {/* Rastreamento */}
              <div style={{ paddingTop: 8, borderTop: "1px solid #1a1a1a" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                  Rastreamento & Analytics
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Facebook Pixel ID</label>
                    <input value={form.config.pixel_facebook ?? ""} onChange={e => setForm(f => f ? { ...f, config: { ...f.config, pixel_facebook: e.target.value } } : f)} placeholder="Ex: 123456789012345" style={inputStyle} />
                    <div style={{ color: "#4b5563", fontSize: 12, marginTop: 4 }}>Dispara PageView automaticamente quando o formulário abre.</div>
                  </div>
                  <div>
                    <label style={labelStyle}>Google Tag Manager ID</label>
                    <input value={form.config.gtm_id ?? ""} onChange={e => setForm(f => f ? { ...f, config: { ...f.config, gtm_id: e.target.value } } : f)} placeholder="Ex: GTM-XXXXXXX" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Google Analytics 4 ID</label>
                    <input value={form.config.ga_id ?? ""} onChange={e => setForm(f => f ? { ...f, config: { ...f.config, ga_id: e.target.value } } : f)} placeholder="Ex: G-XXXXXXXXXX" style={inputStyle} />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Link público do formulário</label>
                <div style={{
                  background: "#0d0d0d", border: "1px solid #2a2a2a",
                  borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#c2a44a",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span>/f/{form.slug}</span>
                  <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer"
                    style={{ color: "#6b7280", textDecoration: "none", fontSize: 12 }}>Abrir ↗</a>
                </div>
              </div>
            </div>
            <button onClick={salvarForm} disabled={salvando} style={{
              marginTop: 32, background: "#c2a44a", color: "#0d0d0d", border: "none",
              borderRadius: 8, padding: "12px 28px", fontWeight: 700, fontSize: 15,
              cursor: "pointer", opacity: salvando ? 0.6 : 1,
            }}>
              {salvando ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneMockup({ imageUrl, posX, posY, onChange }: {
  imageUrl: string; posX: string; posY: string;
  onChange: (x: string, y: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const parsePos = (val: string, def: number) => {
    if (!val) return def;
    if (val.endsWith('%')) return parseFloat(val);
    const m: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };
    return m[val] ?? def;
  };
  const xPct = parsePos(posX, 50);
  const yPct = parsePos(posY, 50);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = screenRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
      const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
      onChangeRef.current(`${x}%`, `${y}%`);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      {/* Moldura do celular */}
      <div style={{
        width: 160, height: 290, border: '8px solid #333', borderRadius: 28,
        overflow: 'hidden', position: 'relative',
        boxShadow: '0 0 0 1px #222, 0 12px 40px rgba(0,0,0,.7)', background: '#0a0a0a',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 50, height: 10, background: '#333', borderRadius: '0 0 8px 8px', zIndex: 3,
        }} />
        {/* Tela arrastável */}
        <div
          ref={screenRef}
          style={{
            width: '100%', height: '100%', position: 'relative',
            backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: `${posX || '50%'} ${posY || '50%'}`,
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#1e1e1e',
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onMouseDown={() => setDragging(true)}
        >
          {/* Ponto focal */}
          <div style={{
            position: 'absolute', left: `${xPct}%`, top: `${yPct}%`,
            transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 2,
          }}>
            <div style={{
              width: 18, height: 18, border: '2px solid #c2a44a', borderRadius: '50%',
              boxShadow: '0 0 0 1px rgba(0,0,0,.6), 0 0 8px rgba(194,164,74,.5)',
            }} />
          </div>
          {!imageUrl && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4b5563', fontSize: 11, flexDirection: 'column', gap: 4 }}>
              <span>📷</span><span>Sem imagem</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>
        {imageUrl ? `Arraste para posicionar · ${xPct}% × ${yPct}%` : 'Adicione uma imagem de fundo primeiro'}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ width: 180, fontSize: 14, color: "#9ca3af", flexShrink: 0 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>{children}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, color: "#6b7280",
  marginBottom: 6, fontWeight: 600, letterSpacing: 0.3,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "#0d0d0d", border: "1px solid #2a2a2a",
  borderRadius: 7, color: "#fff", fontSize: 14,
  fontFamily: "inherit", outline: "none",
};
const colorInput: React.CSSProperties = {
  width: 36, height: 36, border: "1px solid #2a2a2a",
  borderRadius: 6, cursor: "pointer", padding: 2,
  background: "transparent",
};
const iconBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid #2a2a2a",
  color: "#6b7280", borderRadius: 6, width: 28, height: 28,
  cursor: "pointer", fontSize: 13, fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center",
};

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type TipoQ =
  | "nome" | "email" | "whatsapp" | "texto_curto" | "texto_longo"
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
  titulo: string;
  descricao?: string;
  config?: {
    cor_fundo?: string;
    cor_texto?: string;
    cor_botao?: string;
    cor_texto_botao?: string;
    arredondamento?: number;
    fonte?: string;
    alinhamento?: string;
    imagem_fundo?: string;
    logo_url?: string;
    mensagem_obrigado?: string;
  };
  modo_exibicao: "uma_por_vez" | "todas_de_uma";
}

const css = `
  :root {
    --bg: var(--form-bg, #0d0d0d);
    --txt: var(--form-txt, #ffffff);
    --btn: var(--form-btn, #c2a44a);
    --btn-txt: var(--form-btn-txt, #0d0d0d);
    --radius: var(--form-radius, 8px);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  .form-shell {
    min-height: 100vh;
    background: var(--bg);
    color: var(--txt);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: var(--form-fonte, Inter, sans-serif);
    position: relative;
    overflow: hidden;
  }
  .form-bg {
    position: fixed; inset: 0; z-index: 0;
    background-size: cover; background-position: center;
    background-repeat: no-repeat;
  }
  .form-bg-overlay {
    position: fixed; inset: 0; z-index: 1;
    background: rgba(0,0,0,0.55);
  }
  .form-content {
    position: relative; z-index: 2;
    width: 100%; max-width: 640px;
    padding: 40px 24px 80px;
    display: flex; flex-direction: column;
    align-items: center;
  }
  .form-logo {
    width: 56px; height: 56px; object-fit: contain;
    margin-bottom: 28px; border-radius: 10px;
  }
  .form-logo-default {
    width: 48px; height: 48px; border-radius: 10px;
    background: rgba(194,164,74,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; margin-bottom: 28px;
    border: 1px solid rgba(194,164,74,0.3);
  }
  /* Progress */
  .prog-wrap { width: 100%; margin-bottom: 40px; }
  .prog-bar-track {
    width: 100%; height: 3px;
    background: rgba(255,255,255,0.12);
    border-radius: 99px; overflow: hidden;
  }
  .prog-bar-fill {
    height: 100%; background: var(--btn);
    border-radius: 99px; transition: width 0.4s ease;
  }
  .prog-label {
    font-size: 12px; color: rgba(255,255,255,0.4);
    margin-top: 8px; letter-spacing: 0.5px;
    text-align: right;
  }
  /* Question slide */
  .q-slide {
    width: 100%;
    animation: slideUp 0.3s ease both;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .q-label {
    font-size: clamp(22px, 4vw, 30px);
    font-weight: 600;
    line-height: 1.3;
    margin-bottom: 8px;
    color: var(--txt);
    text-align: var(--form-align, center);
  }
  .q-num {
    font-size: 12px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase;
    color: var(--btn); margin-bottom: 12px;
    text-align: var(--form-align, center);
  }
  .q-desc {
    font-size: 15px; color: rgba(255,255,255,0.55);
    margin-bottom: 28px; line-height: 1.65;
    text-align: var(--form-align, center);
  }
  /* Inputs */
  .f-input {
    width: 100%; padding: 14px 18px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: var(--radius);
    color: var(--txt); font-size: 16px;
    font-family: inherit; outline: none;
    transition: border-color 0.2s;
  }
  .f-input:focus { border-color: var(--btn); }
  .f-input::placeholder { color: rgba(255,255,255,0.3); }
  textarea.f-input { min-height: 110px; resize: vertical; }
  /* Options */
  .opts-list { display: flex; flex-direction: column; gap: 10px; width: 100%; }
  .opt-btn {
    width: 100%; padding: 14px 20px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: var(--radius);
    color: var(--txt); font-size: 15px;
    font-family: inherit; cursor: pointer;
    text-align: left; transition: all 0.15s;
    display: flex; align-items: center; gap: 12px;
  }
  .opt-btn:hover { border-color: var(--btn); background: rgba(194,164,74,0.08); }
  .opt-btn.selected {
    border-color: var(--btn);
    background: rgba(194,164,74,0.15);
    color: var(--txt);
  }
  .opt-letter {
    width: 26px; height: 26px; border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
    flex-shrink: 0; transition: all 0.15s;
    color: rgba(255,255,255,0.5);
  }
  .opt-btn.selected .opt-letter {
    background: var(--btn); border-color: var(--btn); color: var(--btn-txt);
  }
  /* Score */
  .score-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  .score-btn {
    width: 48px; height: 48px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px; color: var(--txt);
    font-size: 16px; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
    font-family: inherit;
  }
  .score-btn:hover { border-color: var(--btn); }
  .score-btn.selected { background: var(--btn); border-color: var(--btn); color: var(--btn-txt); }
  /* Sim/Não */
  .yn-row { display: flex; gap: 12px; width: 100%; }
  .yn-btn {
    flex: 1; padding: 16px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: var(--radius); color: var(--txt);
    font-size: 16px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: inherit;
  }
  .yn-btn:hover { border-color: var(--btn); }
  .yn-btn.selected { background: var(--btn); border-color: var(--btn); color: var(--btn-txt); }
  /* OK button */
  .ok-wrap { margin-top: 24px; display: flex; align-items: center; gap: 14px; }
  .ok-btn {
    padding: 13px 28px;
    background: var(--btn); color: var(--btn-txt);
    border: none; border-radius: var(--radius);
    font-size: 15px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    transition: all 0.2s; letter-spacing: 0.3px;
    display: flex; align-items: center; gap: 8px;
  }
  .ok-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
  .ok-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
  .ok-hint { font-size: 12px; color: rgba(255,255,255,0.3); }
  .ok-hint kbd {
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px; padding: 2px 6px;
    font-size: 11px;
  }
  /* Thank you */
  .ty-wrap {
    text-align: center; padding: 40px 20px;
    animation: slideUp 0.4s ease both;
  }
  .ty-icon { font-size: 56px; margin-bottom: 20px; }
  .ty-title { font-size: 32px; font-weight: 700; margin-bottom: 12px; }
  .ty-msg { font-size: 16px; color: rgba(255,255,255,0.6); line-height: 1.7; }
  /* Error / loading */
  .center-msg {
    text-align: center; padding: 80px 24px;
    color: rgba(255,255,255,0.4); font-size: 15px;
  }
  @media (max-width: 480px) {
    .q-label { font-size: 20px; }
    .score-btn { width: 40px; height: 40px; font-size: 14px; }
  }
`;

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function FormPublicoApp({ slug }: { slug: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "form" | "done">("loading");
  const [idx, setIdx] = useState(0);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const cfg = form?.config ?? {};
  const corFundo = cfg.cor_fundo ?? "#0d0d0d";
  const corTexto = cfg.cor_texto ?? "#ffffff";
  const corBotao = cfg.cor_botao ?? "#c2a44a";
  const corBotaoTxt = cfg.cor_texto_botao ?? "#0d0d0d";
  const radius = cfg.arredondamento ?? 8;
  const align = cfg.alinhamento ?? "center";
  const fonte = cfg.fonte ?? "Inter";

  useEffect(() => {
    fetch(`/api/forms/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const { perguntas: p, ...formData } = data;
        setForm(formData);
        setPerguntas(p ?? []);
        setStatus("form");
      })
      .catch(() => setStatus("error"));
  }, [slug]);

  const pergunta = perguntas[idx];
  const modoUma = form?.modo_exibicao === "uma_por_vez";
  const progPct = perguntas.length > 0 ? Math.round(((idx + 1) / perguntas.length) * 100) : 0;

  const valorAtual = pergunta ? (valores[pergunta.id] ?? "") : "";

  const podeAvancar = pergunta
    ? (!pergunta.obrigatorio || valorAtual.trim() !== "")
    : true;

  const setValor = useCallback((id: string, val: string) => {
    setValores(prev => ({ ...prev, [id]: val }));
  }, []);

  const avancar = useCallback(() => {
    if (idx < perguntas.length - 1) {
      setIdx(i => i + 1);
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      enviar();
    }
  }, [idx, perguntas.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && podeAvancar && status === "form") {
        const active = document.activeElement as HTMLElement;
        if (active?.tagName === "TEXTAREA") return;
        e.preventDefault();
        avancar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [avancar, podeAvancar, status]);

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    const respostas = perguntas.map(p => ({
      question_id: p.id,
      tipo: p.tipo,
      label: p.label,
      valor: valores[p.id] ?? "",
    }));

    const utm = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    await fetch(`/api/forms/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        respostas,
        utm_source: utm?.get("utm_source") ?? undefined,
        utm_medium: utm?.get("utm_medium") ?? undefined,
        utm_campaign: utm?.get("utm_campaign") ?? undefined,
      }),
    }).catch(() => undefined);
    setStatus("done");
  }

  if (status === "loading") {
    return (
      <>
        <style>{css}</style>
        <div className="form-shell" style={{ "--form-bg": "#0d0d0d" } as React.CSSProperties}>
          <div className="center-msg">Carregando formulário...</div>
        </div>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <style>{css}</style>
        <div className="form-shell">
          <div className="center-msg">Formulário não encontrado ou inativo.</div>
        </div>
      </>
    );
  }

  const cssVars = {
    "--form-bg": corFundo,
    "--form-txt": corTexto,
    "--form-btn": corBotao,
    "--form-btn-txt": corBotaoTxt,
    "--form-radius": `${radius}px`,
    "--form-fonte": fonte,
    "--form-align": align,
  } as React.CSSProperties;

  if (status === "done") {
    return (
      <>
        <style>{css}</style>
        <div className="form-shell" style={cssVars}>
          {cfg.imagem_fundo && (
            <>
              <div className="form-bg" style={{ backgroundImage: `url(${cfg.imagem_fundo})` }} />
              <div className="form-bg-overlay" />
            </>
          )}
          <div className="form-content">
            <div className="ty-wrap">
              <div className="ty-icon">✓</div>
              <div className="ty-title">Obrigado!</div>
              <div className="ty-msg">
                {cfg.mensagem_obrigado ?? "Suas respostas foram recebidas. Entraremos em contato em breve."}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="form-shell" style={cssVars} ref={topRef}>
        {cfg.imagem_fundo && (
          <>
            <div className="form-bg" style={{ backgroundImage: `url(${cfg.imagem_fundo})` }} />
            <div className="form-bg-overlay" />
          </>
        )}

        <div className="form-content">
          {/* Logo */}
          {cfg.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.logo_url} alt="Logo" className="form-logo" />
          ) : (
            <div className="form-logo-default">◈</div>
          )}

          {/* Progress */}
          {modoUma && perguntas.length > 1 && (
            <div className="prog-wrap">
              <div className="prog-bar-track">
                <div className="prog-bar-fill" style={{ width: `${progPct}%` }} />
              </div>
              <div className="prog-label">{idx + 1} / {perguntas.length}</div>
            </div>
          )}

          {/* Pergunta */}
          {modoUma ? (
            pergunta && (
              <div className="q-slide" key={pergunta.id}>
                <div className="q-num">{idx + 1} →</div>
                <div className="q-label">{pergunta.label}</div>
                {pergunta.descricao && <div className="q-desc">{pergunta.descricao}</div>}
                <CampoResposta
                  p={pergunta}
                  valor={valorAtual}
                  onChange={val => setValor(pergunta.id, val)}
                />
                <div className="ok-wrap">
                  <button
                    className="ok-btn"
                    disabled={!podeAvancar || enviando}
                    onClick={avancar}
                  >
                    {idx === perguntas.length - 1 ? "Enviar" : "OK"} ✓
                  </button>
                  {idx < perguntas.length - 1 && (
                    <span className="ok-hint">ou pressione <kbd>Enter ↵</kbd></span>
                  )}
                </div>
              </div>
            )
          ) : (
            /* Todas de uma vez */
            <div style={{ width: "100%" }}>
              <div className="q-label" style={{ marginBottom: 8 }}>{form?.titulo}</div>
              {form?.descricao && <div className="q-desc">{form.descricao}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 32 }}>
                {perguntas.map((p, i) => (
                  <div key={p.id}>
                    <div className="q-num" style={{ textAlign: "left" }}>{i + 1} →</div>
                    <div className="q-label" style={{ fontSize: 18, marginBottom: 8, textAlign: "left" }}>
                      {p.label}{p.obrigatorio && <span style={{ color: corBotao }}> *</span>}
                    </div>
                    {p.descricao && <div className="q-desc" style={{ textAlign: "left" }}>{p.descricao}</div>}
                    <CampoResposta p={p} valor={valores[p.id] ?? ""} onChange={val => setValor(p.id, val)} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 36 }}>
                <button
                  className="ok-btn"
                  disabled={enviando}
                  onClick={enviar}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {enviando ? "Enviando..." : "Enviar Respostas ✓"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CampoResposta({
  p, valor, onChange,
}: {
  p: Pergunta;
  valor: string;
  onChange: (v: string) => void;
}) {
  if (p.tipo === "texto_longo") {
    return (
      <textarea
        className="f-input"
        placeholder={p.placeholder ?? "Escreva aqui..."}
        value={valor}
        onChange={e => onChange(e.target.value)}
        rows={4}
      />
    );
  }

  if (p.tipo === "multipla_escolha") {
    const opcoes = p.opcoes ?? [];
    return (
      <div className="opts-list">
        {opcoes.map((op, i) => (
          <button
            key={i}
            className={`opt-btn${valor === op ? " selected" : ""}`}
            onClick={() => onChange(op)}
            type="button"
          >
            <span className="opt-letter">{LETRAS[i] ?? i + 1}</span>
            {op}
          </button>
        ))}
      </div>
    );
  }

  if (p.tipo === "pontuacao") {
    const max = p.opcoes?.length ?? 10;
    return (
      <div className="score-row">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            className={`score-btn${valor === String(n) ? " selected" : ""}`}
            onClick={() => onChange(String(n))}
            type="button"
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (p.tipo === "sim_nao") {
    return (
      <div className="yn-row">
        {["Sim", "Não"].map(v => (
          <button
            key={v}
            className={`yn-btn${valor === v ? " selected" : ""}`}
            onClick={() => onChange(v)}
            type="button"
          >
            {v}
          </button>
        ))}
      </div>
    );
  }

  const inputType =
    p.tipo === "email" ? "email"
    : p.tipo === "whatsapp" ? "tel"
    : p.tipo === "data" ? "date"
    : "text";

  return (
    <input
      type={inputType}
      className="f-input"
      placeholder={p.placeholder ?? (
        p.tipo === "nome" ? "Seu nome completo" :
        p.tipo === "email" ? "seu@email.com" :
        p.tipo === "whatsapp" ? "(11) 99999-9999" :
        "Digite aqui..."
      )}
      value={valor}
      onChange={e => onChange(e.target.value)}
    />
  );
}

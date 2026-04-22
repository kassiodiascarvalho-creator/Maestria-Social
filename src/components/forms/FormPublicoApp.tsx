"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type TipoQ =
  | "nome" | "email" | "whatsapp" | "texto_curto" | "texto_longo"
  | "multipla_escolha" | "pontuacao" | "sim_nao" | "data" | "upload";

interface Pergunta {
  id: string; tipo: TipoQ; label: string; descricao?: string;
  placeholder?: string; opcoes?: string[]; obrigatorio: boolean; ordem: number;
}

interface FormConfig {
  cor_fundo?: string; cor_texto?: string; cor_botao?: string; cor_texto_botao?: string;
  arredondamento?: number; fonte?: string; alinhamento?: string;
  imagem_fundo?: string; imagem_posicao_x?: string; imagem_posicao_y?: string;
  overlay_opacidade?: number; logo_url?: string; mensagem_obrigado?: string;
  barra_estilo?: "solida" | "pontilhada" | "tracejada" | "oculta";
  pixel_facebook?: string; gtm_id?: string; ga_id?: string;
}

interface Form {
  id: string; titulo: string; descricao?: string;
  config?: FormConfig; modo_exibicao: "uma_por_vez" | "todas_de_uma";
}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function FormPublicoApp({ slug }: { slug: string }) {
  const [form, setForm] = useState<Form | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "form" | "done">("loading");
  const [idx, setIdx] = useState(0);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const cfg: FormConfig = form?.config ?? {};
  const corFundo     = cfg.cor_fundo        ?? "#0d0d0d";
  const corTexto     = cfg.cor_texto        ?? "#ffffff";
  const corBotao     = cfg.cor_botao        ?? "#c2a44a";
  const corBotaoTxt  = cfg.cor_texto_botao  ?? "#0d0d0d";
  const radius       = cfg.arredondamento   ?? 8;
  const align        = cfg.alinhamento      ?? "center";
  const fonte        = cfg.fonte            ?? "Inter";
  const posX         = cfg.imagem_posicao_x ?? "center";
  const posY         = cfg.imagem_posicao_y ?? "center";
  const overlay      = cfg.overlay_opacidade ?? 55;
  const barraEstilo  = cfg.barra_estilo     ?? "solida";

  // ── Carrega form ──────────────────────────────────────────────────────────
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

  // ── Injeta Pixel / GTM / GA ───────────────────────────────────────────────
  useEffect(() => {
    if (!form) return;
    const { pixel_facebook, gtm_id, ga_id } = cfg;

    if (pixel_facebook) {
      const s = document.createElement("script");
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel_facebook}');fbq('track','PageView');`;
      document.head.appendChild(s);
    }
    if (gtm_id) {
      const s = document.createElement("script");
      s.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm_id}');`;
      document.head.appendChild(s);
    }
    if (ga_id) {
      const s1 = document.createElement("script");
      s1.src = `https://www.googletagmanager.com/gtag/js?id=${ga_id}`;
      s1.async = true;
      document.head.appendChild(s1);
      const s2 = document.createElement("script");
      s2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga_id}');`;
      document.head.appendChild(s2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id]);

  // ── Inicia sessão (rastreia abandonos) ───────────────────────────────────
  // Usa sessionStorage para não criar múltiplos registros no mesmo browser
  useEffect(() => {
    if (status !== "form" || !form) return;
    const sessionKey = `form_session_${slug}`;
    const existente = sessionStorage.getItem(sessionKey);
    if (existente) { setResponseId(existente); return; }

    const utm = new URLSearchParams(window.location.search);
    fetch(`/api/forms/${slug}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        utm_source: utm.get("utm_source") ?? undefined,
        utm_medium: utm.get("utm_medium") ?? undefined,
        utm_campaign: utm.get("utm_campaign") ?? undefined,
        utm_term: utm.get("utm_term") ?? undefined,
        utm_content: utm.get("utm_content") ?? undefined,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.response_id) {
          setResponseId(d.response_id);
          sessionStorage.setItem(sessionKey, d.response_id);
        }
      })
      .catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, form?.id]);

  const pergunta = perguntas[idx];
  const modoUma = form?.modo_exibicao === "uma_por_vez";
  const progPct = perguntas.length > 0 ? Math.round(((idx + 1) / perguntas.length) * 100) : 0;
  const valorAtual = pergunta ? (valores[pergunta.id] ?? "") : "";
  const podeAvancar = pergunta ? (!pergunta.obrigatorio || valorAtual.trim() !== "") : true;

  // Debounce ref para autosave
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValor = useCallback((id: string, val: string) => {
    setValores(prev => {
      const next = { ...prev, [id]: val };

      // Autosave com debounce de 1.5s — salva respostas parciais no abandono
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        const rid = sessionStorage.getItem(`form_session_${slug}`);
        if (!rid || !perguntas.length) return;
        const respostas = perguntas
          .filter(p => next[p.id]?.trim())
          .map(p => ({ question_id: p.id, valor: next[p.id] }));
        if (respostas.length === 0) return;
        fetch(`/api/forms/${slug}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response_id: rid, respostas }),
        }).catch(() => undefined);
      }, 1500);

      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, perguntas]);

  const avancar = useCallback(() => {
    if (idx < perguntas.length - 1) {
      setIdx(i => i + 1);
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      enviar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, perguntas.length, valores]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && podeAvancar && status === "form") {
        if ((document.activeElement as HTMLElement)?.tagName === "TEXTAREA") return;
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
    const utm = new URLSearchParams(window.location.search);
    const respostas = perguntas.map(p => ({
      question_id: p.id, tipo: p.tipo, label: p.label, valor: valores[p.id] ?? "",
    }));
    await fetch(`/api/forms/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        respostas, response_id: responseId,
        utm_source: utm.get("utm_source") ?? undefined,
        utm_medium: utm.get("utm_medium") ?? undefined,
        utm_campaign: utm.get("utm_campaign") ?? undefined,
        utm_term: utm.get("utm_term") ?? undefined,
        utm_content: utm.get("utm_content") ?? undefined,
      }),
    }).catch(() => undefined);
    // Remove sessão após submissão — permite preencher novamente se necessário
    sessionStorage.removeItem(`form_session_${slug}`);
    setStatus("done");
  }

  // ── Barra de progresso ────────────────────────────────────────────────────
  function ProgressBar() {
    if (barraEstilo === "oculta" || !modoUma || perguntas.length <= 1) return null;

    if (barraEstilo === "pontilhada" || barraEstilo === "tracejada") {
      // Segmentos por pergunta
      return (
        <div style={{ width: "100%", marginBottom: 36 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {perguntas.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 99,
                background: i < idx ? corBotao : i === idx ? corBotao : `${corBotao}30`,
                opacity: i <= idx ? 1 : 0.4,
                border: barraEstilo === "pontilhada" && i > idx ? `2px dotted ${corBotao}40` : undefined,
                transition: "background 0.3s",
              }} />
            ))}
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: `${corTexto}50` }}>
            {idx + 1} / {perguntas.length}
          </div>
        </div>
      );
    }

    // Solida (default)
    return (
      <div style={{ width: "100%", marginBottom: 36 }}>
        <div style={{ height: 3, background: `${corBotao}25`, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progPct}%`, background: corBotao, borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: `${corTexto}50`, marginTop: 6 }}>
          {idx + 1} / {perguntas.length}
        </div>
      </div>
    );
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    .form-shell {
      min-height: 100vh;
      background: ${corFundo};
      color: ${corTexto};
      display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start;
      font-family: ${fonte}, Inter, sans-serif;
      position: relative;
      padding: clamp(40px, 8vh, 80px) 0 60px;
    }
    .form-bg {
      position: fixed; inset: 0; z-index: 0;
      background-size: cover;
      background-position: ${posX} ${posY};
      background-repeat: no-repeat;
    }
    .form-bg-overlay {
      position: fixed; inset: 0; z-index: 1;
      background: rgba(0,0,0,${overlay / 100});
    }
    .form-content {
      position: relative; z-index: 2;
      width: 100%; max-width: 640px;
      padding: 0 24px;
      display: flex; flex-direction: column; align-items: center;
    }
    .form-logo { width: 56px; height: 56px; object-fit: contain; margin-bottom: 28px; border-radius: 10px; }
    .form-logo-default {
      width: 48px; height: 48px; border-radius: 10px;
      background: ${corBotao}22; display: flex; align-items: center; justify-content: center;
      font-size: 22px; margin-bottom: 28px; border: 1px solid ${corBotao}44;
    }
    .q-slide { width: 100%; animation: slideUp 0.3s ease both; }
    @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    .q-num { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: ${corBotao}; margin-bottom: 12px; text-align: ${align}; }
    .q-label { font-size: clamp(20px, 4vw, 30px); font-weight: 600; line-height: 1.3; margin-bottom: 8px; color: ${corTexto}; text-align: ${align}; }
    .q-desc { font-size: 15px; color: ${corTexto}80; margin-bottom: 28px; line-height: 1.65; text-align: ${align}; }
    .f-input {
      width: 100%; padding: 14px 18px;
      background: ${corTexto}0f; border: 1px solid ${corTexto}22;
      border-radius: ${radius}px; color: ${corTexto}; font-size: 16px; font-family: inherit; outline: none; transition: border-color 0.2s;
    }
    .f-input:focus { border-color: ${corBotao}; }
    .f-input::placeholder { color: ${corTexto}40; }
    textarea.f-input { min-height: 110px; resize: vertical; }
    .opts-list { display: flex; flex-direction: column; gap: 10px; width: 100%; }
    .opt-btn {
      width: 100%; padding: 14px 20px;
      background: ${corTexto}08; border: 1px solid ${corTexto}20;
      border-radius: ${radius}px; color: ${corTexto}; font-size: 15px;
      font-family: inherit; cursor: pointer; text-align: left; transition: all 0.15s;
      display: flex; align-items: center; gap: 12px;
    }
    .opt-btn:hover { border-color: ${corBotao}; background: ${corBotao}12; }
    .opt-btn.selected { border-color: ${corBotao}; background: ${corBotao}20; }
    .opt-letter {
      width: 26px; height: 26px; border-radius: 4px; border: 1px solid ${corTexto}30;
      display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
      flex-shrink: 0; transition: all 0.15s; color: ${corTexto}60;
    }
    .opt-btn.selected .opt-letter { background: ${corBotao}; border-color: ${corBotao}; color: ${corBotaoTxt}; }
    .score-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .score-btn {
      width: 48px; height: 48px; background: ${corTexto}0a;
      border: 1px solid ${corTexto}20; border-radius: 8px;
      color: ${corTexto}; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit;
    }
    .score-btn:hover { border-color: ${corBotao}; }
    .score-btn.selected { background: ${corBotao}; border-color: ${corBotao}; color: ${corBotaoTxt}; }
    .yn-row { display: flex; gap: 12px; width: 100%; }
    .yn-btn {
      flex: 1; padding: 16px; background: ${corTexto}08;
      border: 1px solid ${corTexto}20; border-radius: ${radius}px;
      color: ${corTexto}; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit;
    }
    .yn-btn:hover { border-color: ${corBotao}; }
    .yn-btn.selected { background: ${corBotao}; border-color: ${corBotao}; color: ${corBotaoTxt}; }
    .ok-wrap { margin-top: 24px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .ok-btn {
      padding: 13px 28px; background: ${corBotao}; color: ${corBotaoTxt};
      border: none; border-radius: ${radius}px; font-size: 15px; font-weight: 700;
      cursor: pointer; font-family: inherit; transition: all 0.2s; letter-spacing: 0.3px;
      display: flex; align-items: center; gap: 8px;
    }
    .ok-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
    .ok-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
    .ok-hint { font-size: 12px; color: ${corTexto}40; }
    .ok-hint kbd { border: 1px solid ${corTexto}30; border-radius: 4px; padding: 2px 6px; font-size: 11px; }
    .ty-wrap { text-align: center; padding: 40px 20px; animation: slideUp 0.4s ease both; }
    .ty-icon { font-size: 56px; margin-bottom: 20px; }
    .ty-title { font-size: 32px; font-weight: 700; margin-bottom: 12px; color: ${corTexto}; }
    .ty-msg { font-size: 16px; color: ${corTexto}80; line-height: 1.7; }
    .center-msg { text-align: center; padding: 80px 24px; color: ${corTexto}60; font-size: 15px; }
    /* Mobile */
    @media (max-width: 480px) {
      .form-content { padding: 28px 16px 60px; }
      .q-label { font-size: 19px; }
      .score-btn { width: 38px; height: 38px; font-size: 13px; }
      .ok-btn { padding: 12px 22px; font-size: 14px; }
      .form-logo { width: 44px; height: 44px; }
      .opt-btn { padding: 12px 14px; font-size: 14px; }
      .f-input { font-size: 16px; } /* prevent iOS zoom */
    }
    @media (max-width: 360px) {
      .q-label { font-size: 17px; }
      .yn-btn { padding: 12px; font-size: 14px; }
    }
  `;

  // ── Estados de loading/erro ───────────────────────────────────────────────
  if (status === "loading") {
    return (
      <>
        <style>{css}</style>
        <div className="form-shell"><div className="center-msg">Carregando formulário...</div></div>
      </>
    );
  }
  if (status === "error") {
    return (
      <>
        <style>{css}</style>
        <div className="form-shell"><div className="center-msg">Formulário não encontrado ou inativo.</div></div>
      </>
    );
  }
  if (status === "done") {
    return (
      <>
        <style>{css}</style>
        <div className="form-shell">
          {cfg.imagem_fundo && <><div className="form-bg" style={{ backgroundImage: `url(${cfg.imagem_fundo})` }} /><div className="form-bg-overlay" /></>}
          <div className="form-content">
            <div className="ty-wrap">
              <div className="ty-icon" style={{ color: corBotao }}>✓</div>
              <div className="ty-title">Obrigado!</div>
              <div className="ty-msg">{cfg.mensagem_obrigado ?? "Suas respostas foram recebidas. Entraremos em contato em breve."}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="form-shell" ref={topRef}>
        {cfg.imagem_fundo && <><div className="form-bg" style={{ backgroundImage: `url(${cfg.imagem_fundo})` }} /><div className="form-bg-overlay" /></>}

        <div className="form-content">
          {cfg.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={cfg.logo_url} alt="Logo" className="form-logo" />
            : <div className="form-logo-default">◈</div>
          }

          <ProgressBar />

          {modoUma ? (
            pergunta && (
              <div className="q-slide" key={pergunta.id}>
                <div className="q-num">{idx + 1} →</div>
                <div className="q-label">{pergunta.label}</div>
                {pergunta.descricao && <div className="q-desc">{pergunta.descricao}</div>}
                <CampoResposta p={pergunta} valor={valorAtual} onChange={v => setValor(pergunta.id, v)} />
                <div className="ok-wrap">
                  <button className="ok-btn" disabled={!podeAvancar || enviando} onClick={avancar}>
                    {idx === perguntas.length - 1 ? (enviando ? "Enviando..." : "Enviar ✓") : "OK ✓"}
                  </button>
                  {idx < perguntas.length - 1 && (
                    <span className="ok-hint">ou pressione <kbd>Enter ↵</kbd></span>
                  )}
                </div>
              </div>
            )
          ) : (
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
                    <CampoResposta p={p} valor={valores[p.id] ?? ""} onChange={v => setValor(p.id, v)} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 36 }}>
                <button className="ok-btn" disabled={enviando} onClick={enviar} style={{ width: "100%", justifyContent: "center" }}>
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

function CampoResposta({ p, valor, onChange }: {
  p: Pergunta; valor: string; onChange: (v: string) => void;
}) {

  if (p.tipo === "texto_longo") {
    return <textarea className="f-input" placeholder={p.placeholder ?? "Escreva aqui..."} value={valor} onChange={e => onChange(e.target.value)} rows={4} />;
  }

  if (p.tipo === "multipla_escolha") {
    return (
      <div className="opts-list">
        {(p.opcoes ?? []).map((op, i) => (
          <button key={i} className={`opt-btn${valor === op ? " selected" : ""}`} onClick={() => onChange(op)} type="button">
            <span className="opt-letter">{LETRAS[i] ?? i + 1}</span>{op}
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
          <button key={n} className={`score-btn${valor === String(n) ? " selected" : ""}`} onClick={() => onChange(String(n))} type="button">{n}</button>
        ))}
      </div>
    );
  }

  if (p.tipo === "sim_nao") {
    return (
      <div className="yn-row">
        {["Sim", "Não"].map(v => (
          <button key={v} className={`yn-btn${valor === v ? " selected" : ""}`} onClick={() => onChange(v)} type="button">{v}</button>
        ))}
      </div>
    );
  }

  const inputType = p.tipo === "email" ? "email" : p.tipo === "whatsapp" ? "tel" : p.tipo === "data" ? "date" : "text";
  return (
    <input type={inputType} className="f-input"
      placeholder={p.placeholder ?? (p.tipo === "nome" ? "Seu nome completo" : p.tipo === "email" ? "seu@email.com" : p.tipo === "whatsapp" ? "(11) 99999-9999" : "Digite aqui...")}
      value={valor} onChange={e => onChange(e.target.value)}
    />
  );
}
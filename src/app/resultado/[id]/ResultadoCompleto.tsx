"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface LeadResult {
  nome: string;
  qs_total: number;
  qs_percentual: number;
  nivel_qs: string;
  pilar_fraco: string;
  scores: Record<string, number>;
}

// ── Dados dos pilares ─────────────────────────────────────────────────────────
const PILARES = [
  { id: "A", name: "Sociabilidade" },
  { id: "B", name: "Comunicação" },
  { id: "C", name: "Relação" },
  { id: "D", name: "Persuasão" },
  { id: "E", name: "Influência" },
];

const INSIGHTS: Record<string, Record<string, string>> = {
  A: {
    neglect: "##SC## em Sociabilidade carrega um padrão muito específico: sabe que deveria se conectar mais, mas consistentemente encontra razões para não fazer isso. O custo não aparece numa conta — aparece nas portas que nunca se abriram, nas oportunidades que foram para outra pessoa.",
    weak: "##SC## em Sociabilidade geralmente indica disposição, mas falta de iniciativa. Você se conecta quando as circunstâncias facilitam — mas raramente cria as circunstâncias. O resultado é uma vida social que depende do acaso em vez de construção intencional.",
    ok: "##SC## em Sociabilidade indica uma base funcional. O gap está na consistência e na profundidade. Você se conecta, mas ainda não transforma conexões em ativos. A diferença para o próximo nível não é quantidade de interações — é qualidade de intenção.",
    strong: "##SC## em Sociabilidade indica que você construiu a fundação que a maioria nunca chega a ter. Você não apenas aceita o social — você o busca e o cultiva. Cada conexão abre para outras, e sua rede trabalha por você mesmo quando você não está presente.",
  },
  B: {
    neglect: "##SC## em Comunicação indica um problema que afeta todas as outras áreas. A consequência aparece em vendas que não fecham, em lideranças que não se consolidam, em relações que ficam na superfície. Comunicação não é talento — é habilidade. E habilidade se treina.",
    weak: "##SC## em Comunicação indica que você geralmente consegue se fazer entender — mas raramente consegue gerar impacto. Há uma diferença enorme entre comunicar informação e comunicar de forma que move pessoas.",
    ok: "##SC## em Comunicação indica habilidade real — mas ainda inconsistente. A maioria das oportunidades perdidas acontece nos momentos de maior pressão: a negociação difícil, a apresentação que mais importava.",
    strong: "##SC## em Comunicação indica domínio de algo que poucos desenvolvem conscientemente: a capacidade de ajustar expressão, presença e mensagem ao contexto. Isso cria atração genuína — pessoas procuram quem se comunica assim.",
  },
  C: {
    neglect: "##SC## em Relação indica uma rede que existe, mas não trabalha. Quando surge uma oportunidade que precisaria de uma indicação — essa porta não existe. As melhores oportunidades da sua vida vão chegar por pessoas.",
    weak: "##SC## em Relação indica conexões circunstanciais — não intencionais. Você tem contatos, mas foram fruto do acaso. Isso gera uma rede que existe no papel, mas não tem profundidade para gerar oportunidades consistentes.",
    ok: "##SC## em Relação indica uma rede funcional — mas ainda muito transacional. Você ativa as conexões quando precisa, mas não as cultiva quando não precisa. As relações de alto nível exigem investimento antes de qualquer retorno.",
    strong: "##SC## em Relação indica que você entende algo que a maioria nunca aprende: relacionamentos são ativos estratégicos que se constroem no longo prazo. As oportunidades chegam até você, não o contrário.",
  },
  D: {
    neglect: "##SC## em Persuasão indica dependência da boa vontade alheia. Sem a habilidade de influenciar decisões, não há como fechar sem que o outro já esteja convencido antes da conversa. Isso limita estruturalmente qualquer resultado que dependa de mover pessoas.",
    weak: "##SC## em Persuasão indica que você persuade quando o caminho está livre — mas trava quando encontra resistência real. É exatamente nos momentos difíceis que os melhores resultados estão disponíveis para quem sabe atravessá-los.",
    ok: "##SC## em Persuasão indica ferramentas presentes, mas aplicação ainda mecânica. A diferença para o próximo nível está em internalizar o processo, não apenas executá-lo.",
    strong: "##SC## em Persuasão indica algo raro: a capacidade de mover pessoas de forma ética e consistente. Você sabe criar as condições para a decisão acontecer — e isso é poder social real, aplicável em qualquer contexto.",
  },
  E: {
    neglect: "##SC## em Influência indica que você ainda não ocupa espaço nas decisões das pessoas ao seu redor. Sua presença é notada, mas raramente determinante. Influência real se constrói, não se herda.",
    weak: "##SC## em Influência indica que você é ouvido(a), mas não decisivo(a). Sua opinião registra, mas raramente muda o rumo das coisas. A consistência que falta é o que transforma influência situacional em autoridade permanente.",
    ok: "##SC## em Influência indica presença real — você já move pessoas, já é consultado(a), já tem peso nas decisões. O que ainda falta é a consistência que transforma influência situacional em autoridade permanente.",
    strong: "##SC## em Influência indica que você conquistou algo que a maioria nunca alcança: autoridade genuína. As pessoas te buscam antes de decidir, te referenciam para outros e agem com base no que você diz.",
  },
};

function secLevel(score: number) {
  const pct = Math.round((score / 50) * 100);
  if (score <= 20) return { label: "Área Negligenciada", color: "#e08080", cls: "weak", pct };
  if (score <= 30) return { label: "Precisa Desenvolver", color: "#d4aa55", cls: "weak", pct };
  if (score <= 40) return { label: "Nível Funcional", color: "#c08a20", cls: "ok", pct };
  return { label: "Competência Sólida", color: "#7acca0", cls: "strong", pct };
}

function qsLevel(total: number) {
  const pct = Math.round((total / 250) * 100);
  if (total <= 100) return { name: "Negligente", color: "#e08080", pct, desc: "Com ##PCT##% no QS, o padrão é identificável: você sabe que a vida social importa, mas consistentemente não investe nisso. O impacto já está acontecendo — em relações que ficam rasas, em oportunidades que vão para quem tem a habilidade que você ainda não desenvolveu." };
  if (total <= 150) return { name: "Iniciante", color: "#d4aa55", pct, desc: "Com ##PCT##% no QS, há consciência, mas ainda falta estrutura. Você se conecta quando as circunstâncias facilitam. O problema: as maiores oportunidades da sua vida não vão esperar que as circunstâncias sejam favoráveis." };
  if (total <= 200) return { name: "Intermediário", color: "#c08a20", pct, desc: "Com ##PCT##% no QS, a base é real — e o gap é específico. Você é percebido(a) como competente, mas raramente como referência. A diferença entre esses dois lugares é menor do que parece." };
  if (total <= 225) return { name: "Avançado", color: "#a8c8f0", pct, desc: "Com ##PCT##% no QS, a maioria dos pilares está desenvolvida com consistência. O que ainda limita está nos detalhes — os contextos de alta pressão onde ainda há perda de precisão." };
  return { name: "Mestre", color: "#7acca0", pct, desc: "Com ##PCT##% no QS, você alcançou algo que pouquíssimas pessoas conseguem: consistência real em todos os pilares. Não é apenas habilidade — é identidade." };
}

// ── Ring SVG ──────────────────────────────────────────────────────────────────
function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 63, circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - pct / 100)), 200);
    return () => clearTimeout(t);
  }, [pct, circ]);
  return (
    <svg style={{ position: "absolute", top: -3, right: -3, bottom: -3, left: -3, width: "calc(100% + 6px)", height: "calc(100% + 6px)", transform: "rotate(-90deg)" }} viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#2a1f18" strokeWidth="3" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1) .4s" }} />
    </svg>
  );
}

// ── Count‑up ──────────────────────────────────────────────────────────────────
function useCountUp(target: number, delay = 300) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      let cur = 0;
      const step = Math.ceil(target / 55);
      const id = setInterval(() => {
        cur = Math.min(cur + step, target);
        setVal(cur);
        if (cur >= target) clearInterval(id);
      }, 16);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return val;
}

// ── Download / Compartilhar ────────────────────────────────────────────────────
function AcoesResultado({ nome, leadId }: { nome: string; leadId: string }) {
  const [baixando, setBaixando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function salvar() {
    if (baixando) return;
    setBaixando(true);
    try {
      const wrap = document.querySelector(".rc-wrap") as HTMLElement | null;
      if (!wrap) return;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(wrap, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0e0f09",
        logging: false,
        height: wrap.scrollHeight,
        onclone: (_doc: Document, el: HTMLElement) => {
          // 1. Ocultar botões
          const acoes = el.querySelector(".rc-acoes") as HTMLElement | null;
          if (acoes) acoes.style.display = "none";

          // 2. Ring: posicionamento absoluto com pixels fixos (não depende de flex)
          el.querySelectorAll<HTMLElement>(".rc-ring-wrap").forEach((wrap) => {
            wrap.style.position = "relative";
            wrap.style.display = "block";
            wrap.style.width = "160px";
            wrap.style.height = "160px";

            const svg = wrap.querySelector("svg") as SVGElement | null;
            if (svg) {
              svg.style.position = "absolute";
              svg.style.top = "-3px";
              svg.style.right = "-3px";
              svg.style.bottom = "-3px";
              svg.style.left = "-3px";
              svg.style.zIndex = "0";
            }

            // Número: centralizado com pixels absolutos
            // Container: 160px. Fonte ~68px cap-height ~44px. Total ~44+4+12=60px. Topo=(160-60)/2=50
            const num = wrap.querySelector(".rc-score-num") as HTMLElement | null;
            if (num) {
              num.style.position = "absolute";
              num.style.top = "42px";
              num.style.left = "0";
              num.style.right = "0";
              num.style.textAlign = "center";
              num.style.lineHeight = "1";
              num.style.zIndex = "1";
            }
            const den = wrap.querySelector(".rc-score-den") as HTMLElement | null;
            if (den) {
              den.style.position = "absolute";
              den.style.top = "114px";
              den.style.left = "0";
              den.style.right = "0";
              den.style.textAlign = "center";
              den.style.zIndex = "1";
            }
          });

          // 3. Badge: pixels fixos, sem depender de inline-block do navegador
          el.querySelectorAll<HTMLElement>(".rc-level-badge").forEach((b) => {
            b.style.display = "block";
            b.style.textAlign = "center";
            b.style.border = "1px solid #c2904d";
            b.style.borderRadius = "40px";
            b.style.padding = "7px 18px 5px";
            b.style.lineHeight = "1.3";
            b.style.transform = "none";
          });

          // 4. Cor herdada do body que html2canvas não propaga
          el.querySelectorAll<HTMLElement>(".rc-cta-title, .rc-cta-sub").forEach((t) => {
            t.style.color = "#fff9e6";
          });

          // 5. Botão CTA: block com height e line-height iguais para centralizar
          el.querySelectorAll<HTMLElement>(".rc-cta-btn").forEach((btn) => {
            btn.style.display = "block";
            btn.style.textAlign = "center";
            btn.style.lineHeight = "50px";
            btn.style.height = "50px";
            btn.style.padding = "0 32px";
          });
        },
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `quociente-social-${nome}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      console.error("[salvar]", err);
    } finally {
      setBaixando(false);
    }
  }

  async function compartilhar() {
    if (compartilhando) return;
    setCompartilhando(true);
    try {
      const url = `https://maestriasocial.com/resultado/${leadId}`;
      const texto = `Acabei de fazer o Diagnóstico de Quociente Social e quero que você faça o seu também! Acesse o link e descubra seu nível:`;
      if (navigator.share) {
        await navigator.share({ title: "Meu Quociente Social — Maestria Social", text: texto, url });
        return;
      }
      await navigator.clipboard.writeText(`${texto}\n${url}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // cancelado
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <div className="rc-acoes">
      <button onClick={salvar} disabled={baixando} className="rc-acao-btn" type="button">
        {baixando ? "Gerando..." : "↓ Salvar resultado"}
      </button>
      <button onClick={compartilhar} disabled={compartilhando} className="rc-acao-btn" type="button">
        {compartilhando ? "..." : copiado ? "✓ Link copiado!" : "↗ Compartilhar"}
      </button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ResultadoCompleto({
  lead,
  leadId,
  fromQuiz,
  whatsappLink,
}: {
  lead: LeadResult;
  leadId: string;
  fromQuiz: boolean;
  whatsappLink?: string;
}) {
  const ql = qsLevel(lead.qs_total);
  const displayScore = useCountUp(lead.qs_percentual);
  const [barWidths, setBarWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      const w: Record<string, number> = {};
      PILARES.forEach((p) => {
        const sc = lead.scores[p.id] ?? 0;
        w[p.id] = Math.round((sc / 50) * 100);
      });
      setBarWidths(w);
    }, 500);
    return () => clearTimeout(t);
  }, [lead.scores]);

  const PILAR_FRACO_MAP: Record<string, string> = {
    Sociabilidade: "A", Comunicação: "B", Relacionamento: "C", Relação: "C", Persuasão: "D", Influência: "E",
  };
  const pilarFracoObj = PILARES.find((p) => p.id === (PILAR_FRACO_MAP[lead.pilar_fraco] ?? "B")) ?? PILARES[1];

  return (
    <>
      <style>{css}</style>
      <main className="rc-wrap">

        {/* ── Hero com ring ─────────────────────────────────────── */}
        <div className="rc-hero">
          <div className="rc-brand">
            <span className="rc-diamond">◆</span>
            <span className="rc-brand-name">Maestria Social</span>
          </div>
          <p className="rc-nome">{lead.nome}</p>
          <h1 className="rc-h1">Quociente Social</h1>

          <div className="rc-ring-wrap">
            <Ring pct={lead.qs_percentual} color={ql.color} />
            <div className="rc-score-num" style={{ color: ql.color }}>{displayScore}</div>
            <div className="rc-score-den">de 100</div>
          </div>

          <div className="rc-level-badge">Nível {lead.nivel_qs}</div>
          <p className="rc-level-desc">
            {ql.desc
              .replace("##PCT##", String(lead.qs_percentual))}
          </p>
        </div>

        {/* ── Share card (capturável para download) ─────────────── */}
        <div id="share-card" className="rc-share-card">
          <div className="sc-header">
            <span className="sc-diamond">◆</span>
            <span className="sc-brand">Maestria Social</span>
          </div>
          <p className="sc-nome">{lead.nome}</p>
          <h2 className="sc-title">Quociente Social</h2>
          <div className="sc-score-row">
            <span className="sc-score-num" style={{ color: ql.color }}>{lead.qs_percentual}</span>
            <span className="sc-score-den">/100</span>
          </div>
          <p className="sc-nivel">Nível {lead.nivel_qs} · {lead.qs_percentual}%</p>
          {lead.pilar_fraco && (
            <p className="sc-pilar-fraco">Pilar com maior oportunidade: <strong>{lead.pilar_fraco}</strong></p>
          )}
          <div className="sc-pilares">
            {PILARES.map((p) => {
              const score = lead.scores[p.id] ?? 0;
              const pct = Math.round((score / 50) * 100);
              const isFraco = lead.pilar_fraco === p.name;
              return (
                <div key={p.id} className={`sc-pilar-row${isFraco ? " is-fraco" : ""}`}>
                  <div className="sc-pilar-info">
                    <span className="sc-pilar-name">{p.name}</span>
                    <span className="sc-pilar-pct">{pct}%</span>
                  </div>
                  <div className="sc-pilar-bar">
                    <div className="sc-pilar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sc-cta-block">
            <p className="sc-cta-text">Quer descobrir o seu?</p>
            <p className="sc-cta-url">maestriasocial.com</p>
          </div>
        </div>

        {/* ── Resultado por pilar ────────────────────────────────── */}
        <div className="rc-section">
          <div className="rc-section-title">Resultado por Pilar</div>
          <div className="rc-pillar-grid">
            {PILARES.map((p) => {
              const score = lead.scores[p.id] ?? 0;
              const sl = secLevel(score);
              const displayPilar = score * 2;
              const isFraco = lead.pilar_fraco === p.name;
              return (
                <div key={p.id} className={`rc-pillar-card${isFraco ? " weakest" : ""}`}>
                  <div className="rc-pillar-label">{p.name}</div>
                  <div className="rc-pillar-score" style={{ color: sl.color }}>
                    {displayPilar}<span>/100</span>
                  </div>
                  <div className="rc-pillar-lvl" style={{ color: sl.color }}>{sl.label}</div>
                  <div className="rc-pillar-bar">
                    <div className="rc-pillar-fill" style={{ width: barWidths[p.id] ? `${barWidths[p.id]}%` : "0%", background: sl.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Diagnóstico por área ───────────────────────────────── */}
        <div className="rc-section">
          <div className="rc-section-title">Diagnóstico por Área</div>
          <div className="rc-insights">
            {PILARES.map((p) => {
              const score = lead.scores[p.id] ?? 0;
              const pct = Math.round((score / 50) * 100);
              const ins = INSIGHTS[p.id];
              let text: string, cls: string;
              if (score <= 20) { text = ins.neglect; cls = "weak"; }
              else if (score <= 30) { text = ins.weak; cls = "weak"; }
              else if (score <= 40) { text = ins.ok; cls = "ok"; }
              else { text = ins.strong; cls = "strong"; }
              text = text.replace("##SC##", `Nota ${score * 2} (${pct}%)`);
              return (
                <div key={p.id} className={`rc-insight ${cls}`}>
                  <div className="rc-insight-head">
                    {p.name} &nbsp;·&nbsp;
                    <strong style={{ color: "#c2904d" }}>{score * 2}/100</strong>
                    <span style={{ color: "#7a6e5e", fontSize: 11 }}> ({pct}%)</span>
                  </div>
                  <p className="rc-insight-text">{text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────────── */}
        <div className="rc-cta">
          <div className="rc-cta-tag">Seu próximo passo</div>
          <div className="rc-cta-title">
            Com {Math.round((( lead.scores[pilarFracoObj.id] ?? 0) / 50) * 100)}% em {pilarFracoObj.name},<br />
            seu próximo passo está claro.
          </div>
          <p className="rc-cta-desc">
            Saber onde você está é o primeiro passo — e a boa notícia é que você pode começar a mudança a partir de agora.
          </p>

          {fromQuiz && whatsappLink ? (
            <a className="rc-cta-btn" href={whatsappLink} target="_blank" rel="noopener noreferrer">
              Quero desenvolver minha {pilarFracoObj.name} →
            </a>
          ) : (
            <Link className="rc-cta-btn" href="/">
              Fazer o diagnóstico agora →
            </Link>
          )}

          <p className="rc-cta-sub">Diagnóstico individual · Plano personalizado · Método Maestria Social</p>

          {fromQuiz && <AcoesResultado nome={lead.nome} leadId={leadId} />}
        </div>

      </main>
    </>
  );
}

const css = `
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0e0f09; color:#fff9e6; font-family:'Inter',system-ui,sans-serif; min-height:100vh; }

  .rc-wrap { max-width:720px; margin:0 auto; padding:48px 20px 80px; display:flex; flex-direction:column; gap:0; }

  /* ── Hero ── */
  .rc-hero { text-align:center; padding-bottom:40px; }
  .rc-brand { display:inline-flex; align-items:center; gap:8px; margin-bottom:20px; }
  .rc-diamond { font-size:8px; color:#c2904d; }
  .rc-brand-name { font-size:11px; font-weight:700; letter-spacing:4px; text-transform:uppercase; color:#c2904d; }
  .rc-nome { font-size:15px; color:#7a6e5e; margin-bottom:6px; }
  .rc-h1 { font-family:'Cormorant Garamond',Georgia,serif; font-size:clamp(32px,5vw,44px); font-style:italic; color:#fff9e6; margin-bottom:28px; }
  .rc-ring-wrap { width:160px; height:160px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; margin:0 auto 24px; position:relative; background:#1a1410; border:1px solid #2a1f18; }
  .rc-score-num { font-family:'Cormorant Garamond',Georgia,serif; font-size:68px; font-weight:700; line-height:1; }
  .rc-score-den { font-size:12px; color:#7a6e5e; margin-top:2px; letter-spacing:.5px; }
  .rc-level-badge { display:inline-block; font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#c2904d; border:1px solid rgba(194,144,77,.2); padding:6px 18px; border-radius:40px; margin-bottom:16px; background:rgba(194,144,77,.04); }
  .rc-level-desc { font-size:15px; color:#7a6e5e; line-height:1.8; max-width:560px; margin:0 auto; }

  /* ── Share card (download) ── */
  .rc-share-card { background:#1a1410; border:1px solid #2a1f18; border-radius:18px; padding:36px 32px; margin-bottom:12px; position:relative; overflow:hidden; }
  .rc-share-card::before { content:''; position:absolute; top:-100px; right:-100px; width:260px; height:260px; background:radial-gradient(circle, rgba(194,144,77,.08) 0%, transparent 65%); pointer-events:none; }
  .sc-header { display:flex; align-items:center; gap:8px; margin-bottom:20px; }
  .sc-diamond { font-size:7px; color:#c2904d; }
  .sc-brand { font-size:10px; font-weight:700; letter-spacing:3.5px; text-transform:uppercase; color:#c2904d; }
  .sc-nome { font-size:13px; color:#7a6e5e; margin-bottom:4px; }
  .sc-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:30px; font-style:italic; color:#fff9e6; margin-bottom:14px; }
  .sc-score-row { display:flex; align-items:baseline; gap:6px; margin-bottom:4px; }
  .sc-score-num { font-family:'Cormorant Garamond',Georgia,serif; font-size:80px; font-weight:700; line-height:1; }
  .sc-score-den { font-size:20px; color:#7a6e5e; }
  .sc-nivel { font-size:14px; color:#fff9e6; margin-top:40px; margin-bottom:6px; }
  .sc-pilar-fraco { font-size:12px; color:#7a6e5e; margin-bottom:20px; }
  .sc-pilar-fraco strong { color:#c2904d; }
  .sc-pilares { display:flex; flex-direction:column; gap:10px; margin-bottom:24px; }
  .sc-pilar-row { display:flex; flex-direction:column; gap:4px; }
  .sc-pilar-info { display:flex; justify-content:space-between; }
  .sc-pilar-name { font-size:12px; color:#7a6e5e; }
  .sc-pilar-pct { font-size:12px; color:#7a6e5e; font-weight:600; }
  .sc-pilar-bar { height:3px; background:#2a1f18; border-radius:99px; overflow:hidden; }
  .sc-pilar-fill { height:100%; background:#3d3328; border-radius:99px; }
  .sc-pilar-row.is-fraco .sc-pilar-name, .sc-pilar-row.is-fraco .sc-pilar-pct { color:#c2904d; font-weight:700; }
  .sc-pilar-row.is-fraco .sc-pilar-fill { background:linear-gradient(90deg,#c2904d,#fee69d); }
  .sc-cta-block { text-align:center; padding-top:20px; border-top:1px solid #2a1f18; }
  .sc-cta-text { font-size:13px; color:#7a6e5e; margin-bottom:6px; }
  .sc-cta-url { font-size:11px; color:#4a3e30; letter-spacing:1px; }

  /* ── Ações ── */
  .rc-acoes { display:flex; gap:10px; margin-top:20px; flex-wrap:wrap; justify-content:center; }
  .rc-acao-btn { flex:1; min-width:140px; background:rgba(194,144,77,.06); border:1px solid rgba(194,144,77,.2); color:#c2904d; font-size:13px; font-weight:600; padding:11px 14px; border-radius:10px; cursor:pointer; font-family:inherit; transition:background .15s,border-color .15s; }
  .rc-acao-btn:hover { background:rgba(194,144,77,.12); border-color:rgba(194,144,77,.4); }
  .rc-acao-btn:disabled { opacity:.5; cursor:default; }

  /* ── Seção genérica ── */
  .rc-section { margin-top:32px; }
  .rc-section-title { font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#c2904d; margin-bottom:16px; display:flex; align-items:center; gap:10px; }
  .rc-section-title::after { content:''; flex:1; height:1px; background:rgba(194,144,77,.15); }

  /* ── Pillar cards ── */
  .rc-pillar-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .rc-pillar-card { background:rgba(255,255,255,.018); border:1px solid #2a1f18; border-radius:12px; padding:18px 20px; }
  .rc-pillar-card.weakest { border-color:rgba(220,90,70,.3); background:rgba(220,90,70,.03); }
  .rc-pillar-label { font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#7a6e5e; margin-bottom:6px; }
  .rc-pillar-score { font-family:'Cormorant Garamond',Georgia,serif; font-size:28px; font-weight:700; margin-bottom:4px; }
  .rc-pillar-score span { font-size:15px; color:#7a6e5e; font-family:'Inter',system-ui,sans-serif; font-weight:400; }
  .rc-pillar-lvl { font-size:12px; font-weight:500; margin-bottom:10px; }
  .rc-pillar-bar { height:3px; background:#2a1f18; border-radius:99px; overflow:hidden; }
  .rc-pillar-fill { height:100%; border-radius:99px; transition:width 1s cubic-bezier(.4,0,.2,1) .4s; }

  /* ── Insights ── */
  .rc-insights { display:flex; flex-direction:column; gap:10px; }
  .rc-insight { background:rgba(255,255,255,.018); border:1px solid #2a1f18; border-radius:10px; padding:16px 18px; }
  .rc-insight.weak { border-left:3px solid rgba(224,100,80,.35); }
  .rc-insight.ok { border-left:3px solid rgba(192,138,32,.4); }
  .rc-insight.strong { border-left:3px solid rgba(76,200,130,.4); }
  .rc-insight-head { font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#7a6e5e; margin-bottom:6px; }
  .rc-insight-text { font-size:15px; color:#fff9e6; line-height:1.75; font-weight:300; }

  /* ── CTA ── */
  .rc-cta { margin-top:40px; background:linear-gradient(135deg,rgba(194,144,77,.09),rgba(194,144,77,.03)); border:1px solid rgba(194,144,77,.22); border-radius:18px; padding:36px 32px; text-align:center; }
  .rc-cta-tag { font-size:11px; font-weight:700; letter-spacing:3.5px; text-transform:uppercase; color:#c2904d; margin-bottom:14px; }
  .rc-cta-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:clamp(22px,3.5vw,30px); font-weight:700; margin-bottom:12px; line-height:1.3; }
  .rc-cta-desc { font-size:15px; color:#7a6e5e; line-height:1.75; max-width:460px; margin:0 auto 24px; }
  .rc-cta-btn { display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg,#c2904d,#d4a055); color:#0a0907; font-family:'Inter',system-ui,sans-serif; font-size:15px; font-weight:700; padding:15px 32px; border-radius:12px; border:none; cursor:pointer; text-decoration:none; transition:all .2s; letter-spacing:.3px; }
  .rc-cta-btn:hover { filter:brightness(1.08); transform:translateY(-2px); box-shadow:0 10px 36px rgba(194,144,77,.28); }
  .rc-cta-sub { font-size:12px; color:#4a3e30; margin-top:12px; letter-spacing:.3px; }

  @media(max-width:540px) {
    .rc-pillar-grid { grid-template-columns:1fr; }
    .rc-cta { padding:24px 20px; }
    .rc-share-card { padding:28px 20px; }
  }
`;

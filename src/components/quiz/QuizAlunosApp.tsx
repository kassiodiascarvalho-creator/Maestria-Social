"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── DATA (mesmo quiz completo) ───────────────────────────────────────────────
const SECTIONS = [
  {
    id: "A", label: "Seção A — Sociabilidade", title: "Sociabilidade", sub: "Etapa 0 — Pré-processo",
    desc: "A fundação de tudo. Avalie sua abertura para o social, sua disposição de interagir e sua consciência sobre o valor das relações.",
    questions: [
      { type: "a", text: "Em ambientes com pessoas desconhecidas, me sinto à vontade para iniciar conversas sem depender de ser abordado(a) primeiro." },
      { type: "a", text: "Tenho disposição genuína para expandir meu círculo social além das pessoas que já conheço — e tomo ações concretas para isso." },
      { type: "a", text: "Não evito situações sociais por desconforto. Quando me sinto fora da zona de conforto, me aproximo mesmo assim." },
      { type: "a", text: "Saio de eventos sociais com energia — a presença de outras pessoas me estimula mais do que me esgota." },
      { type: "s", text: "Quando estou em um evento com pessoas novas, costumo sair com ao menos um contato relevante que não conhecia antes." },
      { type: "d", text: "Consigo criar conexões novas com facilidade — não dependo de ser apresentado(a) para iniciar uma relação relevante." },
      { type: "v", text: "Recebo com frequência comentários de que sou acessível e aberto(a) — as pessoas se aproximam de mim com facilidade e naturalmente." },
      { type: "s", text: "Quando conheço alguém novo em contexto informal, costumo ser eu quem mantém a conversa fluindo — faço perguntas, crio abertura, sustento o contato." },
      { type: "d", text: "Quando estou num ambiente novo e desconhecido, tomo a iniciativa de me apresentar sem esperar que alguém faça isso por mim." },
      { type: "v", text: "Pessoas que me conhecem costumam me apresentar a outros com facilidade — dizem que sou fácil de se relacionar." },
    ],
  },
  {
    id: "B", label: "Seção B — Comunicação", title: "Comunicação", sub: "Pilar 1",
    desc: "Como você se expressa, escuta e usa presença, voz e linguagem corporal para gerar atenção e atração.",
    questions: [
      { type: "a", text: "Quando me expresso, as pessoas demonstram atenção genuína — raramente perco o fio da conversa ou sinto que estou sendo tolerado(a)." },
      { type: "a", text: "Minha linguagem corporal transmite presença: mantenho contato visual com naturalidade, tenho postura aberta e gestos alinhados ao que digo." },
      { type: "a", text: "Ajusto meu tom, volume e ritmo de fala de acordo com o contexto — sei quando ser direto(a), quando suavizar e quando silenciar." },
      { type: "a", text: "Minha comunicação verbal é clara e assertiva — falo o que precisa ser dito, da forma que precisa, no momento certo." },
      { type: "s", text: "Após apresentações, reuniões ou conversas importantes, as pessoas demonstram que absorveram o que eu queria transmitir." },
      { type: "d", text: "Quando uma conversa importante não gera o resultado que eu queria, consigo identificar com precisão onde a comunicação falhou." },
      { type: "v", text: "Recebo comentários frequentes sobre minha forma de comunicar — as pessoas costumam dizer que sou claro(a) ou que prendo a atenção quando falo." },
      { type: "s", text: "Quando preciso explicar algo complexo, consigo adaptar minha linguagem ao nível e ao contexto da pessoa — sem perder clareza nem profundidade." },
      { type: "d", text: "Em situações de tensão ou conflito, consigo me comunicar com calma e precisão — sem elevar o tom, sem ceder à pressão emocional." },
      { type: "v", text: "Sou frequentemente escolhido(a) para representar grupos, apresentar ideias ou falar em nome de outros." },
    ],
  },
  {
    id: "C", label: "Seção C — Relação", title: "Relação", sub: "Pilar 2",
    desc: "Sua capacidade de transformar interações em vínculos reais, construir redes de alto nível e manter relações estratégicas.",
    questions: [
      { type: "a", text: "Tenho a habilidade de transformar um primeiro contato em um relacionamento real — sei conduzir a conexão além do superficial." },
      { type: "a", text: "Mantenho contato ativo com as pessoas da minha rede — não apareço apenas quando preciso de algo." },
      { type: "a", text: "Faço parte de círculos sociais e profissionais de alto nível, e sei como entrar e permanecer relevante nesses ambientes." },
      { type: "a", text: "Dedico tempo para conectar pessoas entre si — sirvo de ponte entre contatos que se beneficiariam de se conhecer." },
      { type: "s", text: "Quando olho para as conexões relevantes que fiz nos últimos meses, a maioria veio de iniciativa minha — não do acaso." },
      { type: "d", text: "Minha rede já me trouxe oportunidades concretas — indicações, portas abertas, parcerias — sem que eu precisasse pedir diretamente." },
      { type: "v", text: "Quando surge uma oportunidade relevante no meu setor, costumo ser acionado(a) pela minha rede antes de ficar sabendo por outros canais." },
      { type: "s", text: "Quando penso nas oportunidades mais relevantes que já tive, a maioria chegou por indicação ou conexão de alguém da minha rede." },
      { type: "d", text: "Consigo entrar em ambientes de alto nível e me tornar uma presença relevante — não apenas um rosto conhecido, mas alguém que agrega valor." },
      { type: "v", text: "Pessoas da minha rede me apresentam a outras espontaneamente porque enxergam valor estratégico na conexão." },
    ],
  },
  {
    id: "D", label: "Seção D — Persuasão", title: "Persuasão", sub: "Pilar 3",
    desc: "Sua capacidade de influenciar decisões, criar rapport, lidar com objeções e mover pessoas à ação de forma ética.",
    questions: [
      { type: "a", text: "Antes de persuadir, invisto em entender as motivações e necessidades da outra pessoa — e só então apresento minha proposta." },
      { type: "a", text: "Uso técnicas de influência de forma natural e ética — crio rapport, adapto minha abordagem à pessoa e ao contexto." },
      { type: "a", text: "Quando enfrento objeções ou resistência, mantenho clareza e confiança — sem recuar por pressão nem forçar sem estratégia." },
      { type: "a", text: "Consigo convencer pessoas a adotarem minha visão, comprarem minhas ideias ou tomarem decisões alinhadas com o que proponho." },
      { type: "s", text: "Quando preciso convencer alguém de algo importante, consigo conduzir a conversa de forma que a pessoa se sente motivada a dizer sim." },
      { type: "d", text: "Quando minha persuasão não gera o resultado esperado, consigo identificar exatamente onde perdi a pessoa — e corrijo na próxima tentativa." },
      { type: "v", text: "Quando defendo uma posição ou ideia, as pessoas ao meu redor tendem a mudar de opinião ou considerar seriamente meu ponto de vista." },
      { type: "s", text: "Em negociações difíceis, costumo sair com um resultado igual ou melhor do que o esperado — sem precisar forçar ou ceder além do planejado." },
      { type: "d", text: "Quando preciso convencer alguém resistente, consigo identificar a objeção real por trás da aparente — e responder ao que bloqueia a decisão." },
      { type: "v", text: "Colegas ou clientes me consultam antes de decisões importantes porque sabem que apresentarei os ângulos que ainda não consideraram." },
    ],
  },
  {
    id: "E", label: "Seção E — Influência", title: "Influência", sub: "Etapa Final — Pós-processo",
    desc: "O resultado de tudo que você desenvolveu. Avalie o impacto real que você exerce sobre as pessoas e ambientes ao seu redor.",
    questions: [
      { type: "a", text: "Sou reconhecido(a) como uma referência de liderança no meu círculo — as pessoas buscam minha opinião antes de decidir." },
      { type: "a", text: "Tenho facilidade em construir reputação sólida e confiável — o que falo tem peso porque o que faço é coerente com o que digo." },
      { type: "a", text: "Sei liderar sem autoritarismo — conquisto respeito e colaboração pela presença e pelo exemplo, não pela posição ou pela pressão." },
      { type: "a", text: "Tenho habilidade para mobilizar pessoas em torno de uma causa, projeto ou objetivo — consigo fazer com que outros queiram o que eu quero." },
      { type: "s", text: "Quando tomo uma posição num grupo, o debate tende a se organizar ao redor do que eu disse — minha fala muda a direção da conversa." },
      { type: "s", text: "Em situações de conflito entre pessoas, costumo ser chamado(a) para mediar — porque os envolvidos confiam que serei justo(a)." },
      { type: "d", text: "Quando quero engajar pessoas em torno de algo, consigo fazê-las sentir que é delas a ideia — crio convicção genuína, não obediência." },
      { type: "d", text: "Consigo inspirar e emocionar com minha comunicação — as pessoas saem de uma conversa comigo com mais energia ou motivação." },
      { type: "v", text: "Sou reconhecido(a) como alguém que cria conexões estratégicas de valor real — as pessoas me procuram para ser apresentadas a outros." },
      { type: "v", text: "Minhas ações e decisões deixam impacto duradouro nos ambientes em que estou — quando saio, as pessoas percebem a diferença." },
    ],
  },
];

const SCALE_LABELS = ["", "Discordo totalmente", "Discordo parcialmente", "Neutro", "Concordo parcialmente", "Concordo totalmente"];
const TYPE_LABEL: Record<string, string> = { a: "Avalie", s: "Situação", d: "Reflexão", v: "Validação" };

function qsLevel(total: number) {
  const pct = Math.round((total / 250) * 100);
  if (total <= 100) return { name: "Negligente", color: "#e08080", pct };
  if (total <= 150) return { name: "Iniciante", color: "#d4aa55", pct };
  if (total <= 200) return { name: "Intermediário", color: "#c08a20", pct };
  if (total <= 225) return { name: "Avançado", color: "#a8c8f0", pct };
  return { name: "Mestre", color: "#7acca0", pct };
}

// ─── STYLES (idêntico ao QuizApp) ─────────────────────────────────────────────
const css = `
  :root {
    --bg:#0e0f09; --s1:#1a1410; --s2:#22180f; --border:#2a1f18;
    --gold:#c2904d; --gl:#d4a055; --gdim:rgba(194,144,77,.13);
    --text:#fff9e6; --muted:#7a6e5e; --muted2:#3d3328; --r:14px;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;}
  .noise{position:fixed;inset:0;pointer-events:none;opacity:.018;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:200px;}
  .wrap{max-width:760px;margin:0 auto;padding:40px 24px 80px;}
  .header{text-align:center;padding:60px 0 40px;}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:24px;}
  .eyebrow svg{width:8px;height:8px;fill:var(--gold);}
  .h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(54px,10vw,88px);font-weight:700;line-height:1.02;letter-spacing:-.5px;margin-bottom:20px;}
  .h1 em{font-style:italic;color:var(--gold);}
  .subtitle{font-size:16px;color:var(--muted);line-height:1.6;max-width:520px;margin:0 auto 32px;}
  .meta-row{display:flex;justify-content:center;gap:32px;flex-wrap:wrap;}
  .meta-item{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);}
  .meta-dot{width:5px;height:5px;border-radius:50%;background:var(--gold);}
  .prog{margin-bottom:32px;}
  .prog-top{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:8px;}
  .prog-bar{display:flex;gap:4px;}
  .prog-seg{flex:1;height:3px;background:var(--muted2);border-radius:2px;transition:background .3s;}
  .prog-seg.done{background:var(--gold);}
  .prog-seg.active{background:var(--gl);}
  .card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:24px;}
  .card-head{padding:32px 40px 24px;border-bottom:1px solid var(--border);}
  .sec-badge{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;}
  .sec-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(24px,4vw,32px);font-weight:700;line-height:1.2;margin-bottom:4px;}
  .sec-sub{font-size:12px;color:var(--muted);margin-bottom:12px;}
  .sec-desc{font-size:14px;color:var(--muted);line-height:1.6;margin-bottom:20px;}
  .scale-info{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px;color:#9a8e7e;padding:10px 16px;background:rgba(192,138,32,.07);border:1px solid rgba(192,138,32,.2);border-radius:10px;letter-spacing:.3px;}
  .pips{display:flex;gap:4px;}
  .pip{width:22px;height:22px;border-radius:6px;background:var(--muted2);display:flex;align-items:center;justify-content:center;font-size:11px;}
  .questions{padding:0 40px 32px;}
  .q-item{padding:20px 0;border-bottom:1px solid var(--border);}
  .q-item:last-child{border-bottom:none;}
  .q-item.answered .q-text{color:var(--text);}
  .q-type{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
  .q-type.sit{color:#7ab0d4;} .q-type.dor{color:#c8a870;}
  .q-text{font-size:15px;color:#b8aa96;line-height:1.55;margin-bottom:14px;}
  .rating-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  .rb{width:40px;height:40px;border-radius:10px;border:1px solid var(--border);background:var(--s2);color:var(--muted);font-size:15px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;}
  .rb:hover{border-color:var(--gold);color:var(--gold);}
  .rb.sel{background:var(--gdim);border-color:var(--gold);color:var(--gold);font-weight:600;}
  .r-label{font-size:12px;color:var(--muted);margin-left:4px;}
  .nav{display:flex;gap:12px;justify-content:flex-end;}
  .btn{padding:12px 28px;border-radius:10px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;letter-spacing:.3px;}
  .btn-back{background:transparent;border:1px solid var(--border);color:var(--muted);}
  .btn-back:hover{border-color:var(--muted);color:var(--text);}
  .btn-next{background:var(--gold);color:#0a0907;}
  .btn-next:hover{background:var(--gl);transform:translateY(-1px);box-shadow:0 6px 24px rgba(192,138,32,.2);}
  .btn-next:disabled{opacity:.3;cursor:not-allowed;transform:none;box-shadow:none;}
  .btn-final{padding:16px 40px;font-size:16px;background:linear-gradient(135deg,var(--gold),var(--gl));}
  .btn-final:hover{filter:brightness(1.07);transform:translateY(-2px);box-shadow:0 8px 32px rgba(192,138,32,.25);}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  .fade-in{animation:fadeUp .28s ease both;}
  @media(max-width:540px){
    .card-head,.questions{padding-left:20px;padding-right:20px;}
    .meta-row{gap:20px;}
  }
`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function QuizAlunosApp() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(SECTIONS.map(s => Array(s.questions.length).fill(0)));
  const [erroFinal, setErroFinal] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const sec = SECTIONS[step];
  const isLast = step === SECTIONS.length - 1;
  const allAnswered = step < SECTIONS.length && answers[step].every((v: number) => v > 0);

  const sectionScores = answers.map((a: number[]) => a.reduce((x: number, y: number) => x + y, 0));
  const total = sectionScores.reduce((x: number, y: number) => x + y, 0);
  const ql = qsLevel(total);

  const weakestIdx = sectionScores.indexOf(Math.min(...sectionScores));

  // Submete resultado anonimamente e redireciona para resultado
  useEffect(() => {
    if (step !== SECTIONS.length) return;
    const scores = { A: sectionScores[0], B: sectionScores[1], C: sectionScores[2], D: sectionScores[3], E: sectionScores[4] };

    sessionStorage.setItem("quiz_result", JSON.stringify({
      total,
      percentual: ql.pct,
      nivel: ql.name,
      pilarFraco: SECTIONS[weakestIdx]?.title ?? "Comunicação",
      scores,
    }));

    fetch('/api/quiz-alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.lead_id) {
          router.push(`/resultado/${data.lead_id}?from=quiz`);
        } else {
          setErroFinal(true);
        }
      })
      .catch(() => setErroFinal(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth" });

  const rate = (si: number, v: number) => {
    setAnswers(prev => {
      const next = prev.map((a: number[]) => [...a]);
      next[step][si] = v;
      return next;
    });
  };

  const goNext = () => {
    if (isLast) {
      setStep(SECTIONS.length);
    } else {
      setStep(s => s + 1);
    }
    scrollTop();
  };
  const goBack = () => { setStep(s => s - 1); scrollTop(); };

  const typeMap: Record<string, string> = { a: "", s: "sit", d: "dor", v: "" };

  return (
    <>
      <style>{css}</style>
      <div className="noise" />
      <div className="wrap" ref={topRef}>

        {step < SECTIONS.length && (
          <div className="header fade-in">
            <div className="eyebrow">
              <svg viewBox="0 0 8 8"><polygon points="4,0 8,8 0,8"/></svg>
              Maestria Social — Alunos Gambit
            </div>
            <h1 className="h1">Seu <em>Quociente</em><br />Social</h1>
            <p className="subtitle">Diagnóstico completo do seu nível de Inteligência Social — 5 pilares avaliados, resultado imediato.</p>
            <div className="meta-row">
              <span className="meta-item"><span className="meta-dot"/>50 questões</span>
              <span className="meta-item"><span className="meta-dot"/>5 pilares avaliados</span>
              <span className="meta-item"><span className="meta-dot"/>Diagnóstico imediato</span>
            </div>
          </div>
        )}

        {step < SECTIONS.length && (
          <div className="prog fade-in">
            <div className="prog-top">
              <span>Seção {step + 1} de {SECTIONS.length}</span>
              <span>{Math.round(((step + 1) / SECTIONS.length) * 100)}%</span>
            </div>
            <div className="prog-bar">
              {SECTIONS.map((_, i) => (
                <div key={i} className={`prog-seg${i < step ? " done" : i === step ? " active" : ""}`} />
              ))}
            </div>
          </div>
        )}

        {step < SECTIONS.length && (
          <div className="card fade-in" key={step}>
            <div className="card-head">
              <div className="sec-badge">{sec.label}</div>
              <div className="sec-title">{sec.title}</div>
              <div className="sec-sub">{sec.sub}</div>
              <p className="sec-desc">{sec.desc}</p>
              <div className="scale-info">
                <div className="pips">{[1,2,3,4,5].map(v => <div key={v} className="pip">{v}</div>)}</div>
                <span>1 = Discordo totalmente &nbsp;·&nbsp; 2 = Discordo parcialmente &nbsp;·&nbsp; 3 = Neutro &nbsp;·&nbsp; 4 = Concordo parcialmente &nbsp;·&nbsp; 5 = Concordo totalmente</span>
              </div>
            </div>
            <div className="questions">
              {sec.questions.map((q, si) => (
                <div key={si} className={`q-item${answers[step][si] > 0 ? " answered" : ""}`}>
                  <div className={`q-type ${typeMap[q.type] || ""}`}>{TYPE_LABEL[q.type]}</div>
                  <p className="q-text">{q.text}</p>
                  <div className="rating-row">
                    {[1,2,3,4,5].map(v => (
                      <button key={v} className={`rb${answers[step][si] === v ? " sel" : ""}`}
                        title={SCALE_LABELS[v]} onClick={() => rate(si, v)}>{v}</button>
                    ))}
                    {answers[step][si] > 0 && (
                      <span className="r-label">{SCALE_LABELS[answers[step][si]]}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step < SECTIONS.length && (
          <div className="nav">
            {step > 0 && <button className="btn btn-back" onClick={goBack}>← Voltar</button>}
            <button className={`btn btn-next${isLast ? " btn-final" : ""}`}
              disabled={!allAnswered} onClick={goNext}>
              {isLast ? "Ver Resultado QS →" : "Próxima Seção →"}
            </button>
          </div>
        )}

        {step === SECTIONS.length && !erroFinal && (
          <div style={{ textAlign: "center", padding: "100px 20px", color: "#7a6e5e" }}>
            <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              ◆ Calculando seu Quociente Social...
            </div>
            <div style={{ fontSize: 12, color: "#4a3e30" }}>Aguarde um momento</div>
          </div>
        )}

        {step === SECTIONS.length && erroFinal && (
          <div style={{ textAlign: "center", padding: "100px 20px", color: "#7a6e5e" }}>
            <div style={{ fontSize: 16, marginBottom: 16, color: "#e08080" }}>Ops, algo deu errado ao gerar seu resultado.</div>
            <button
              style={{ padding: "12px 28px", background: "#c2904d", color: "#0a0907", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              onClick={() => { setStep(0); setAnswers(SECTIONS.map(s => Array(s.questions.length).fill(0))); setErroFinal(false); }}
            >
              Tentar novamente
            </button>
          </div>
        )}

      </div>
    </>
  );
}

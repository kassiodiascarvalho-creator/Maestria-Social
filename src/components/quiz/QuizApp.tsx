"use client";

import { useState, useEffect, useRef } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────
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
    id: "C", label: "Seção C — Relacionamento", title: "Relacionamento", sub: "Pilar 2",
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
    neglect: "##SC## em Relacionamento indica uma rede que existe, mas não trabalha. Quando surge uma oportunidade que precisaria de uma indicação — essa porta não existe. As melhores oportunidades da sua vida vão chegar por pessoas.",
    weak: "##SC## em Relacionamento indica conexões circunstanciais — não intencionais. Você tem contatos, mas foram fruto do acaso. Isso gera uma rede que existe no papel, mas não tem profundidade para gerar oportunidades consistentes.",
    ok: "##SC## em Relacionamento indica uma rede funcional — mas ainda muito transacional. Você ativa as conexões quando precisa, mas não as cultiva quando não precisa. As relações de alto nível exigem investimento antes de qualquer retorno.",
    strong: "##SC## em Relacionamento indica que você entende algo que a maioria nunca aprende: relacionamentos são ativos estratégicos que se constroem no longo prazo. As oportunidades chegam até você, não o contrário.",
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
  if (total <= 100) return { name: "Negligente", color: "#e08080", pct, desc: "Com ##SCORE## (##PCT##%) no QS, o padrão é identificável: você sabe que a vida social importa, mas consistentemente não investe nisso. O impacto já está acontecendo — em relações que ficam rasas, em oportunidades que vão para quem tem a habilidade que você ainda não desenvolveu." };
  if (total <= 150) return { name: "Iniciante", color: "#d4aa55", pct, desc: "Com ##SCORE## (##PCT##%) no QS, há consciência, mas ainda falta estrutura. Você se conecta quando as circunstâncias facilitam. O problema: as maiores oportunidades da sua vida não vão esperar que as circunstâncias sejam favoráveis." };
  if (total <= 200) return { name: "Intermediário", color: "#c08a20", pct, desc: "Com ##SCORE## (##PCT##%) no QS, a base é real — e o gap é específico. Você é percebido(a) como competente, mas raramente como referência. A diferença entre esses dois lugares é menor do que parece." };
  if (total <= 225) return { name: "Avançado", color: "#a8c8f0", pct, desc: "Com ##SCORE## (##PCT##%) no QS, a maioria dos pilares está desenvolvida com consistência. O que ainda limita está nos detalhes — os contextos de alta pressão onde ainda há perda de precisão." };
  return { name: "Mestre", color: "#7acca0", pct, desc: "Com ##SCORE## (##PCT##%) no QS, você alcançou algo que pouquíssimas pessoas conseguem: consistência real em todos os pilares. Não é apenas habilidade — é identidade." };
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  :root {
    --bg:#0e0f09; --s1:#1a1410; --s2:#22180f; --border:#2a1f18;
    --gold:#c2904d; --gl:#d4a055; --gdim:rgba(194,144,77,.13);
    --text:#fff9e6; --muted:#7a6e5e; --muted2:#3d3328; --r:14px;
    --font-serif:var(--font-serif,'Cormorant Garamond',serif);
    --font-sans:var(--font-sans,'Inter',sans-serif);
    --font-display:var(--font-display,'Bebas Neue',sans-serif);
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:var(--bg);color:var(--text);font-family:var(--font-sans);min-height:100vh;overflow-x:hidden;}
  .noise{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.035;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
  .wrap{position:relative;z-index:1;max-width:740px;margin:0 auto;padding:56px 24px 120px;}
  .header{text-align:center;margin-bottom:72px;}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:var(--gold);border:1px solid var(--gdim);padding:7px 20px;border-radius:40px;margin-bottom:28px;background:rgba(192,138,32,.04);}
  .eyebrow svg{width:7px;height:7px;fill:var(--gold);}
  .h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(54px,10vw,88px);font-weight:700;line-height:1.02;letter-spacing:-.5px;margin-bottom:20px;}
  .h1 em{font-style:italic;color:var(--gold);}
  .subtitle{color:var(--muted);font-size:17px;line-height:1.8;max-width:500px;margin:0 auto 32px;font-weight:300;}
  .meta-row{display:flex;align-items:center;justify-content:center;gap:32px;font-size:13px;color:var(--muted2);letter-spacing:.5px;flex-wrap:wrap;}
  .meta-item{display:flex;align-items:center;gap:7px;}
  .meta-dot{width:3px;height:3px;border-radius:50%;background:var(--gold);opacity:.35;}
  .prog{margin-bottom:44px;}
  .prog-top{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:12px;letter-spacing:.3px;}
  .prog-bar{display:flex;gap:4px;}
  .prog-seg{height:2px;flex:1;border-radius:99px;background:var(--border);transition:background .4s;}
  .prog-seg.done{background:var(--gold);}
  .prog-seg.active{background:linear-gradient(90deg,var(--gold),var(--gl));}
  .card{background:var(--s1);border:1px solid var(--border);border-radius:20px;overflow:hidden;margin-bottom:20px;}
  .card-head{padding:32px 40px 24px;border-bottom:1px solid var(--border);background:linear-gradient(140deg,var(--s2),var(--s1));}
  .sec-badge{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;}
  .sec-badge::after{content:'';display:block;width:32px;height:1px;background:var(--gdim);}
  .sec-title{font-family:var(--font-serif);font-size:clamp(24px,4vw,32px);font-weight:700;line-height:1.2;margin-bottom:4px;}
  .sec-sub{font-size:14px;color:var(--muted);font-weight:400;margin-bottom:14px;}
  .sec-desc{font-size:15px;color:var(--muted);line-height:1.75;font-weight:300;margin-bottom:16px;}
  .scale-info{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px;color:#9a8e7e;padding:10px 16px;background:rgba(192,138,32,.07);border:1px solid rgba(192,138,32,.2);border-radius:10px;letter-spacing:.3px;}
  .pips{display:flex;gap:4px;}
  .pip{width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#9a8e7e;border:1px solid rgba(255,255,255,.08);}
  .questions{padding:24px 40px 32px;display:flex;flex-direction:column;gap:24px;}
  .q-item{display:flex;flex-direction:column;gap:10px;transition:opacity .2s;}
  .q-type{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted2);}
  .q-type.sit{color:rgba(192,138,32,.55);}
  .q-type.dor{color:rgba(210,110,90,.6);}
  .q-text{font-size:15.5px;color:var(--text);font-weight:300;line-height:1.7;padding-left:14px;border-left:2px solid var(--border);transition:border-color .25s;}
  .q-item.answered .q-text{border-left-color:rgba(192,138,32,.5);}
  .rating-row{display:flex;gap:6px;align-items:center;padding-left:14px;flex-wrap:wrap;}
  .rb{width:42px;height:42px;border-radius:8px;border:1px solid var(--border);background:transparent;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;font-family:var(--font-sans);}
  .rb:hover{border-color:rgba(192,138,32,.45);background:rgba(192,138,32,.07);color:var(--gl);transform:scale(1.08);}
  .rb.sel{background:var(--gold);border-color:var(--gold);color:#0a0907;transform:scale(1.1);}
  .r-label{font-size:12px;color:var(--muted2);margin-left:4px;font-style:italic;}
  .nav{display:flex;gap:12px;justify-content:flex-end;margin-top:4px;}
  .btn{padding:14px 28px;border-radius:var(--r);border:none;font-family:var(--font-sans);font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;letter-spacing:.3px;}
  .btn-back{background:transparent;border:1px solid var(--border);color:var(--muted);}
  .btn-back:hover{border-color:var(--muted);color:var(--text);}
  .btn-next{background:var(--gold);color:#0a0907;}
  .btn-next:hover{background:var(--gl);transform:translateY(-1px);box-shadow:0 6px 24px rgba(192,138,32,.2);}
  .btn-next:disabled{opacity:.3;cursor:not-allowed;transform:none;box-shadow:none;}
  .btn-final{padding:16px 40px;font-size:16px;background:linear-gradient(135deg,var(--gold),var(--gl));}
  .btn-final:hover{filter:brightness(1.07);transform:translateY(-2px);box-shadow:0 8px 32px rgba(192,138,32,.25);}
  .result{animation:fadeUp .6s ease both;}
  .r-hero{background:var(--s1);border:1px solid var(--border);border-radius:20px 20px 0 0;padding:52px 44px 40px;text-align:center;position:relative;overflow:hidden;}
  .r-hero::before{content:'';position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:400px;height:400px;background:radial-gradient(circle,rgba(192,138,32,.07) 0%,transparent 65%);pointer-events:none;}
  .ring-wrap{width:140px;height:140px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 24px;position:relative;background:var(--s2);border:1px solid var(--border);}
  .ring-svg{position:absolute;inset:-3px;width:calc(100%+6px);height:calc(100%+6px);transform:rotate(-90deg);}
  .ring-track{fill:none;stroke:var(--border);stroke-width:3;}
  .ring-fill{fill:none;stroke-width:3.5;stroke-linecap:round;stroke-dasharray:390;stroke-dashoffset:390;transition:stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1) .4s;}
  .score-num{font-family:var(--font-display,'Bebas Neue',sans-serif);font-size:78px;font-weight:400;line-height:1;letter-spacing:2px;}
  .score-den{font-size:13px;color:var(--muted);margin-top:2px;letter-spacing:.5px;}
  .score-pct{font-size:12px;font-weight:700;letter-spacing:.5px;color:var(--muted);margin-top:3px;}
  .level-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--gold);border:1px solid var(--gdim);padding:6px 18px;border-radius:40px;margin-bottom:14px;background:rgba(192,138,32,.04);}
  .level-name{font-family:var(--font-serif);font-size:clamp(30px,5vw,44px);font-weight:900;margin-bottom:12px;line-height:1.15;}
  .level-desc{font-size:16px;color:var(--muted);line-height:1.8;max-width:520px;margin:0 auto 20px;font-weight:300;}
  .notice{display:inline-flex;align-items:flex-start;gap:8px;font-size:13px;color:rgba(192,138,32,.65);background:rgba(192,138,32,.05);border:1px solid rgba(192,138,32,.13);padding:12px 16px;border-radius:10px;line-height:1.65;max-width:480px;text-align:left;}
  .r-body{background:var(--s1);border:1px solid var(--border);border-top:none;padding:32px 44px;}
  .r-body.last{border-radius:0 0 20px 20px;}
  .section-title{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:20px;display:flex;align-items:center;gap:10px;}
  .section-title::after{content:'';flex:1;height:1px;background:var(--gdim);}
  .pillar-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .pillar-card{background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:12px;padding:18px 20px;}
  .pillar-card.weakest{border-color:rgba(220,90,70,.3);background:rgba(220,90,70,.03);}
  .pillar-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
  .pillar-score{font-family:var(--font-serif);font-size:28px;font-weight:700;margin-bottom:2px;}
  .pillar-score span{font-size:15px;color:var(--muted);font-family:var(--font-sans);font-weight:400;}
  .pillar-pct{font-size:11px;font-weight:700;letter-spacing:.5px;margin-bottom:5px;}
  .pillar-lvl{font-size:13px;font-weight:500;margin-bottom:10px;}
  .pillar-bar{height:3px;background:var(--border);border-radius:99px;overflow:hidden;}
  .pillar-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.4,0,.2,1) .4s;width:0;}
  .insights{display:flex;flex-direction:column;gap:10px;}
  .ins{background:rgba(255,255,255,.018);border:1px solid var(--border);border-radius:10px;padding:16px 18px;}
  .ins.weak{border-left:3px solid rgba(224,100,80,.35);}
  .ins.ok{border-left:3px solid rgba(192,138,32,.4);}
  .ins.strong{border-left:3px solid rgba(76,200,130,.4);}
  .ins-head{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:5px;}
  .ins-text{font-size:15px;color:var(--text);line-height:1.7;font-weight:300;}
  .divider{height:1px;background:var(--border);margin:32px 0;position:relative;}
  .divider::after{content:'◆';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--s1);padding:0 14px;font-size:8px;color:var(--gold);opacity:.3;}
  .cta{background:linear-gradient(135deg,rgba(192,138,32,.09),rgba(192,138,32,.03));border:1px solid rgba(192,138,32,.22);border-radius:18px;padding:36px 40px;text-align:center;}
  .cta-tag{font-size:11px;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;color:var(--gold);margin-bottom:14px;}
  .cta-title{font-family:var(--font-serif);font-size:clamp(22px,3.5vw,30px);font-weight:700;margin-bottom:12px;line-height:1.3;}
  .cta-desc{font-size:16px;color:var(--muted);line-height:1.75;max-width:480px;margin:0 auto 26px;font-weight:300;}
  .cta-btn{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,var(--gold),var(--gl));color:#0a0907;font-family:var(--font-sans);font-size:16px;font-weight:700;padding:16px 36px;border-radius:var(--r);border:none;cursor:pointer;transition:all .2s;letter-spacing:.3px;text-decoration:none;}
  .cta-btn:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 10px 36px rgba(192,138,32,.28);}
  .cta-sub{font-size:12px;color:var(--muted2);margin-top:12px;letter-spacing:.5px;}
  .restart{width:100%;margin-top:16px;padding:15px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:var(--r);font-family:var(--font-sans);font-size:15px;font-weight:500;cursor:pointer;transition:all .2s;letter-spacing:.3px;}
  .restart:hover{border-color:var(--gold);color:var(--gold);}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  .fade-in{animation:fadeUp .28s ease both;}
  @media(max-width:540px){
    .card-head,.questions,.r-hero,.r-body{padding-left:20px;padding-right:20px;}
    .pillar-grid{grid-template-columns:1fr;}
    .cta{padding:24px 20px;}
    .meta-row{gap:20px;}
  }
`;

// ─── RING COMPONENT ───────────────────────────────────────────────────────────
function Ring({ score, max, color }: { score: number; max: number; color: string }) {
  const r = 63, circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - score / max)), 200);
    return () => clearTimeout(t);
  }, [score, max, circ]);
  return (
    <svg className="ring-svg" viewBox="0 0 140 140">
      <circle className="ring-track" cx="70" cy="70" r={r} />
      <circle className="ring-fill" cx="70" cy="70" r={r}
        style={{ stroke: color, strokeDashoffset: offset }} />
    </svg>
  );
}

// ─── COUNT UP ─────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return val;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function QuizApp() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(SECTIONS.map(s => Array(s.questions.length).fill(0)));
  const [barWidths, setBarWidths] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const sec = SECTIONS[step];
  const isLast = step === SECTIONS.length - 1;
  const allAnswered = step < SECTIONS.length && answers[step].every((v: number) => v > 0);

  const sectionScores = answers.map((a: number[]) => a.reduce((x: number, y: number) => x + y, 0));
  const total = sectionScores.reduce((x: number, y: number) => x + y, 0);
  const ql = qsLevel(total);
  const scoreDisplay = useCountUp(step === SECTIONS.length ? total : 0);

  const weakestIdx = sectionScores.indexOf(Math.min(...sectionScores));

  // Salva resultado na API quando exibe resultado
  useEffect(() => {
    if (step !== SECTIONS.length) return;
    const leadId = typeof window !== 'undefined' ? sessionStorage.getItem('lead_id') : null;
    if (!leadId) return;
    setSaving(true);
    const scores = { A: sectionScores[0], B: sectionScores[1], C: sectionScores[2], D: sectionScores[3], E: sectionScores[4] };
    fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, scores }),
    }).finally(() => setSaving(false));
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
      setTimeout(() => setBarWidths(sectionScores.map((s: number) => secLevel(s).pct)), 500);
    } else {
      setStep(s => s + 1);
    }
    scrollTop();
  };
  const goBack = () => { setStep(s => s - 1); scrollTop(); };
  const restart = () => {
    setStep(0);
    setAnswers(SECTIONS.map(s => Array(s.questions.length).fill(0)));
    setBarWidths([]);
    scrollTop();
  };

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
              Maestria Social
            </div>
            <h1 className="h1">Seu <em>Quociente</em><br />Social</h1>
            <p className="subtitle">Um diagnóstico preciso do seu nível de Inteligência Social — avaliando Sociabilidade, Comunicação, Relacionamento, Persuasão e Influência.</p>
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
                <span>Avalie de 1 a 5</span>
                <div className="pips">{[1,2,3,4,5].map(v => <div key={v} className="pip">{v}</div>)}</div>
                <span>1 = Discordo totalmente &nbsp;·&nbsp; 5 = Concordo totalmente</span>
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

        {step === SECTIONS.length && (
          <div className="result">
            <div className="r-hero">
              <div className="ring-wrap">
                <Ring score={total} max={250} color={ql.color} />
                <div className="score-num" style={{ color: ql.color }}>{scoreDisplay}</div>
                <div className="score-den">de 250</div>
                <div className="score-pct">{ql.pct}%</div>
              </div>
              <div className="level-badge">Quociente Social (QS)</div>
              <div className="level-name" style={{ color: ql.color }}>{ql.name}</div>
              <p className="level-desc">
                {ql.desc.replace("##SCORE##", String(total)).replace("##PCT##", String(ql.pct))}
              </p>
              <div className="notice">
                ◆ Este teste é o primeiro passo do seu Mapeamento de Maestria Social. A partir deste resultado, você tem o diagnóstico preciso de onde está — e pode iniciar um planejamento personalizado para desenvolver cada um dos pilares.
              </div>
            </div>

            <div className="r-body">
              <div className="section-title">Resultado por Pilar</div>
              <div className="pillar-grid">
                {SECTIONS.map((s, i) => {
                  const sc = sectionScores[i];
                  const sl = secLevel(sc);
                  return (
                    <div key={i} className={`pillar-card${i === weakestIdx ? " weakest" : ""}`}>
                      <div className="pillar-label">{s.title}</div>
                      <div className="pillar-score" style={{ color: sl.color }}>{sc}<span> / 50</span></div>
                      <div className="pillar-pct" style={{ color: sl.color }}>{sl.pct}%</div>
                      <div className="pillar-lvl" style={{ color: sl.color }}>{sl.label}</div>
                      <div className="pillar-bar">
                        <div className="pillar-fill" style={{ width: barWidths[i] ? `${barWidths[i]}%` : "0%", background: sl.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="r-body" style={{ borderTop: "none", paddingTop: 0 }}>
              <div className="section-title" style={{ marginTop: 28 }}>Diagnóstico por Área</div>
              <div className="insights">
                {SECTIONS.map((s, i) => {
                  const sc = sectionScores[i];
                  const pct = Math.round((sc / 50) * 100);
                  const ins = INSIGHTS[s.id];
                  let text: string, cls: string;
                  if (sc <= 20) { text = ins.neglect; cls = "weak"; }
                  else if (sc <= 30) { text = ins.weak; cls = "weak"; }
                  else if (sc <= 40) { text = ins.ok; cls = "ok"; }
                  else { text = ins.strong; cls = "strong"; }
                  text = text.replace("##SC##", `Nota ${sc} (${pct}%)`);
                  const sl = secLevel(sc);
                  return (
                    <div key={i} className={`ins ${cls}`}>
                      <div className="ins-head">
                        {s.title} &nbsp;·&nbsp;
                        <strong style={{ color: "var(--gold)" }}>{sc}/50</strong>
                        <span style={{ color: "var(--muted)", fontSize: 10 }}> ({pct}%)</span>
                      </div>
                      <p className="ins-text">{text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="r-body last" style={{ borderTop: "none", paddingTop: 0 }}>
              <div className="divider" />
              <div className="cta">
                <div className="cta-tag">Seu próximo passo</div>
                <div className="cta-title">
                  Com {Math.round((sectionScores[weakestIdx] / 50) * 100)}% em {SECTIONS[weakestIdx].title}, seu próximo passo está claro.
                </div>
                <p className="cta-desc">
                  Saber onde você está é o primeiro passo — e a boa notícia é que você pode começar a mudança a partir de agora. Apresente seu resultado e dê início ao próximo passo da sua transformação.
                </p>
                <button className="cta-btn">
                  Quero desenvolver minha {SECTIONS[weakestIdx].title} →
                </button>
                <div className="cta-sub">Diagnóstico individual · Plano personalizado · Método Maestria Social</div>
              </div>
              <button className="restart" onClick={restart}>↺ Refazer o Diagnóstico</button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

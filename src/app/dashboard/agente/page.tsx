export default function AgentePage() {
  return (
    <>
      <style>{css}</style>
      <div className="agente-page">
        <div className="agente-header">
          <h1 className="agente-title">Agente SDR</h1>
          <p className="agente-sub">Configurações e status do agente de qualificação via WhatsApp</p>
        </div>

        <div className="agente-grid">
          <div className="agente-card">
            <div className="card-label">Status do Agente</div>
            <div className="status-row">
              <span className="status-dot active" />
              <span className="status-text">Ativo</span>
            </div>
            <p className="card-desc">O agente responde automaticamente às mensagens recebidas via WhatsApp, qualifica leads e atualiza o status em tempo real.</p>
          </div>

          <div className="agente-card">
            <div className="card-label">Modelo de IA</div>
            <div className="model-badge">GPT-4.1 Mini</div>
            <p className="card-desc">OpenAI GPT-4.1 Mini com temperatura 0.7. Adapta o roteiro de sondagem ao pilar mais fraco de cada lead.</p>
          </div>

          <div className="agente-card full">
            <div className="card-label">Pilares de Sondagem</div>
            <div className="pilares-grid">
              {PILARES.map((p) => (
                <div key={p.nome} className="pilar-item">
                  <div className="pilar-nome">{p.nome}</div>
                  <p className="pilar-foco">{p.foco}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="agente-card full">
            <div className="card-label">Fluxo de Qualificação</div>
            <div className="flow">
              {FLOW.map((step, i) => (
                <div key={i} className="flow-step">
                  <div className="flow-num">{i + 1}</div>
                  <div>
                    <div className="flow-title">{step.title}</div>
                    <div className="flow-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const PILARES = [
  { nome: "Sociabilidade", foco: "Dificuldade em iniciar conexões ou desconforto em ambientes novos" },
  { nome: "Comunicação", foco: "Dificuldade em se expressar com impacto ou clareza" },
  { nome: "Relacionamento", foco: "Rede superficial ou falta de cultivo intencional" },
  { nome: "Persuasão", foco: "Trava em negociações ou não consegue mover pessoas à ação" },
  { nome: "Influência", foco: "Não é visto como referência ou não exerce impacto nas decisões" },
];

const FLOW = [
  { title: "Quiz concluído", desc: "Lead termina o diagnóstico e recebe o resultado" },
  { title: "Primeira mensagem", desc: "Agente envia mensagem personalizada baseada no nível QS e pilar fraco" },
  { title: "Sondagem adaptativa", desc: "3–4 trocas explorando a dor principal do lead" },
  { title: "Classificação", desc: "Lead classificado como 🔴 Frio, 🟡 Morno ou 🔴 Quente" },
  { title: "Qualificações salvas", desc: "Dores, objeções e contexto registrados automaticamente no perfil" },
];

const css = `
  .agente-page{padding:40px;}
  .agente-header{margin-bottom:32px;}
  .agente-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:700;color:#fff9e6;margin-bottom:6px;}
  .agente-sub{font-size:14px;color:#7a6e5e;font-weight:300;}
  .agente-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .agente-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px 28px;}
  .agente-card.full{grid-column:1/-1;}
  .card-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;margin-bottom:14px;}
  .card-desc{font-size:14px;color:#7a6e5e;line-height:1.65;font-weight:300;}
  .status-row{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
  .status-dot{width:8px;height:8px;border-radius:50%;background:#4a4a4a;}
  .status-dot.active{background:#6acca0;box-shadow:0 0 6px rgba(106,204,160,.4);}
  .status-text{font-size:14px;font-weight:600;color:#6acca0;}
  .model-badge{display:inline-block;background:rgba(194,144,77,.1);border:1px solid rgba(194,144,77,.2);color:#c2904d;font-size:13px;font-weight:700;padding:6px 14px;border-radius:8px;margin-bottom:12px;letter-spacing:.5px;}
  .pilares-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}
  .pilar-item{background:rgba(255,255,255,.02);border:1px solid #2a1f18;border-radius:10px;padding:14px 16px;}
  .pilar-nome{font-size:13px;font-weight:600;color:#c2904d;margin-bottom:4px;}
  .pilar-foco{font-size:12px;color:#7a6e5e;line-height:1.5;font-weight:300;}
  .flow{display:flex;flex-direction:column;gap:16px;}
  .flow-step{display:flex;align-items:flex-start;gap:16px;}
  .flow-num{width:28px;height:28px;border-radius:50%;background:rgba(194,144,77,.1);border:1px solid rgba(194,144,77,.2);color:#c2904d;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .flow-title{font-size:14px;font-weight:600;color:#fff9e6;margin-bottom:2px;}
  .flow-desc{font-size:13px;color:#7a6e5e;font-weight:300;}
  @media(max-width:768px){.agente-grid{grid-template-columns:1fr;}.agente-page{padding:20px;}}
`;

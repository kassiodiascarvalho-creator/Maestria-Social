import CapturaForm from "@/components/landing/CapturaForm";

export const metadata = {
  title: "Maestria Social — Descubra seu Quociente Social",
  description:
    "Um diagnóstico preciso do seu nível de Inteligência Social em 5 pilares: Sociabilidade, Comunicação, Relacionamento, Persuasão e Influência.",
};

export default function HomePage() {
  return (
    <>
      <style>{css}</style>
      <div className="ms-noise" />

      <main className="ms-wrap">
        {/* ── HERO ── */}
        <section className="ms-hero">
          <div className="ms-eyebrow">
            <span className="ms-diamond">◆</span>
            Maestria Social
          </div>

          <h1 className="ms-h1">
            Qual é o seu<br />
            <em>Quociente</em><br />
            Social?
          </h1>

          <p className="ms-subtitle">
            Um diagnóstico preciso e personalizado do seu nível de
            Inteligência Social — avaliando os 5 pilares que determinam
            o impacto que você exerce sobre as pessoas ao seu redor.
          </p>

          <div className="ms-pillars">
            {["Sociabilidade", "Comunicação", "Relacionamento", "Persuasão", "Influência"].map((p, i) => (
              <div key={p} className="ms-pillar">
                <span className="ms-pillar-n">0{i + 1}</span>
                <span className="ms-pillar-name">{p}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── FORMULÁRIO ── */}
        <section className="ms-form-section">
          <div className="ms-form-card">
            <div className="ms-form-header">
              <p className="ms-form-tag">Diagnóstico gratuito</p>
              <h2 className="ms-form-title">Comece seu mapeamento</h2>
              <p className="ms-form-desc">
                Preencha abaixo para acessar o teste de 50 questões e
                receber seu diagnóstico completo.
              </p>
            </div>
            <CapturaForm />
            <div className="ms-trust">
              <div className="ms-trust-item">
                <span className="ms-trust-num">50</span>
                <span className="ms-trust-label">questões</span>
              </div>
              <div className="ms-trust-divider" />
              <div className="ms-trust-item">
                <span className="ms-trust-num">5</span>
                <span className="ms-trust-label">pilares avaliados</span>
              </div>
              <div className="ms-trust-divider" />
              <div className="ms-trust-item">
                <span className="ms-trust-num">~8</span>
                <span className="ms-trust-label">minutos</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── PROVA SOCIAL (fora do grid) ── */}
      <section className="ms-proof">
        <div className="ms-proof-line" />
        <p className="ms-proof-text">
          &ldquo;Depois do diagnóstico, entendi exatamente onde estava
          perdendo oportunidades. Era minha Persuasão — e nunca tinha
          percebido isso.&rdquo;
        </p>
        <p className="ms-proof-author">— Participante do Método Maestria Social</p>
        <div className="ms-proof-line" />
      </section>
    </>
  );
}

const css = `
  :root {
    --ms-bg:      #0e0f09;
    --ms-surface: #30241d;
    --ms-gold:    #c2904d;
    --ms-gold-lt: #fee69d;
    --ms-text:    #fff9e6;
    --ms-muted:   #7a6e5e;
    --ms-muted2:  #3d3328;
    --ms-border:  #2a1f18;
    --ms-gdim:    rgba(194,144,77,.15);
    --ms-serif:   'Cormorant Garamond', Georgia, serif;
    --ms-sans:    'Inter', system-ui, sans-serif;
    --ms-r:       14px;
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--ms-bg);
    color: var(--ms-text);
    font-family: var(--ms-sans);
    min-height: 100vh;
    overflow-x: hidden;
  }

  .ms-noise {
    position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: .03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .ms-wrap {
    position: relative; z-index: 1;
    max-width: 1100px; margin: 0 auto;
    padding: 0 24px 48px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 0 64px;
    align-items: center;
    min-height: 100vh;
  }

  .ms-hero { grid-column: 1; grid-row: 1 / 3; padding: 80px 0; }

  .ms-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 700; letter-spacing: 4px;
    text-transform: uppercase; color: var(--ms-gold);
    border: 1px solid var(--ms-gdim);
    padding: 7px 18px; border-radius: 40px;
    background: rgba(194,144,77,.04);
    margin-bottom: 36px;
  }
  .ms-diamond { font-size: 8px; }

  .ms-h1 {
    font-family: var(--ms-serif);
    font-size: clamp(52px, 7vw, 90px);
    font-weight: 700; line-height: 1.02;
    letter-spacing: -.5px; margin-bottom: 28px;
  }
  .ms-h1 em { font-style: italic; color: var(--ms-gold); }

  .ms-subtitle {
    font-size: 18px; color: var(--ms-muted);
    line-height: 1.8; font-weight: 300;
    max-width: 480px; margin-bottom: 48px;
  }

  .ms-pillars { display: flex; flex-direction: column; gap: 10px; }
  .ms-pillar {
    display: flex; align-items: center; gap: 16px;
    padding: 13px 20px;
    background: rgba(255,255,255,.018);
    border: 1px solid var(--ms-border);
    border-radius: 10px;
    transition: border-color .2s, background .2s;
  }
  .ms-pillar:hover { border-color: var(--ms-gdim); background: rgba(194,144,77,.03); }
  .ms-pillar-n {
    font-family: var(--ms-serif); font-size: 17px;
    font-weight: 700; color: var(--ms-gold); opacity: .5; min-width: 26px;
  }
  .ms-pillar-name { font-size: 14px; font-weight: 400; color: var(--ms-text); letter-spacing: .3px; }

  .ms-form-section { grid-column: 2; grid-row: 1; padding-top: 80px; }

  .ms-form-card {
    background: var(--ms-surface);
    border: 1px solid var(--ms-border);
    border-radius: 24px; padding: 44px 40px;
    position: relative; overflow: hidden;
  }
  .ms-form-card::before {
    content: ''; position: absolute; top: -80px; right: -80px;
    width: 240px; height: 240px;
    background: radial-gradient(circle, rgba(194,144,77,.07) 0%, transparent 65%);
    pointer-events: none;
  }

  .ms-form-header { margin-bottom: 28px; }
  .ms-form-tag {
    font-size: 10px; font-weight: 700; letter-spacing: 3px;
    text-transform: uppercase; color: var(--ms-gold); margin-bottom: 10px;
  }
  .ms-form-title {
    font-family: var(--ms-serif);
    font-size: clamp(20px, 2.5vw, 26px);
    font-weight: 700; line-height: 1.25; margin-bottom: 8px;
  }
  .ms-form-desc { font-size: 14px; color: var(--ms-muted); line-height: 1.7; font-weight: 300; }

  .ms-field-group { display: flex; flex-direction: column; gap: 14px; margin-bottom: 22px; }
  .ms-field { display: flex; flex-direction: column; gap: 5px; }
  .ms-label {
    font-size: 11px; font-weight: 600; letter-spacing: .5px;
    color: var(--ms-muted); text-transform: uppercase;
  }
  .ms-input {
    background: rgba(255,255,255,.04);
    border: 1px solid var(--ms-border);
    border-radius: var(--ms-r);
    padding: 13px 16px;
    font-family: var(--ms-sans); font-size: 15px; color: var(--ms-text);
    outline: none; width: 100%;
    transition: border-color .2s, background .2s;
  }
  .ms-input::placeholder { color: #6b5e4e; }
  .ms-input:focus { border-color: rgba(194,144,77,.5); background: rgba(194,144,77,.04); }
  .ms-input--error { border-color: rgba(220,80,60,.5) !important; }
  .ms-error { font-size: 12px; color: #e05840; font-weight: 500; }
  .ms-api-error { font-size: 13px; color: #e05840; margin-bottom: 14px; text-align: center; }

  .ms-cta-btn {
    width: 100%; padding: 15px 24px;
    background: linear-gradient(135deg, var(--ms-gold), #d4a055);
    color: #0e0f09;
    font-family: var(--ms-sans); font-size: 15px; font-weight: 700;
    border: none; border-radius: var(--ms-r);
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: filter .2s, transform .2s, box-shadow .2s; letter-spacing: .3px;
  }
  .ms-cta-btn:hover:not(:disabled) {
    filter: brightness(1.08); transform: translateY(-2px);
    box-shadow: 0 10px 36px rgba(194,144,77,.28);
  }
  .ms-cta-btn:disabled { opacity: .6; cursor: not-allowed; }
  .ms-arrow { font-size: 18px; }

  .ms-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(14,15,9,.3);
    border-top-color: #0e0f09;
    border-radius: 50%;
    animation: ms-spin .7s linear infinite; display: inline-block;
  }
  @keyframes ms-spin { to { transform: rotate(360deg); } }

  .ms-privacy { font-size: 11px; color: var(--ms-muted); text-align: center; margin-top: 12px; letter-spacing: .3px; }

  .ms-select {
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a6e5e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center;
    padding-right: 40px; cursor: pointer;
  }
  .ms-select option { background: #1a1410; color: #fff9e6; }

  .ms-trust {
    display: flex; align-items: center; justify-content: center;
    gap: 20px; margin-top: 24px; padding-top: 24px;
    border-top: 1px solid var(--ms-border);
  }
  .ms-trust-item { text-align: center; }
  .ms-trust-num {
    display: block; font-family: var(--ms-serif);
    font-size: 26px; font-weight: 700; color: var(--ms-gold); line-height: 1; margin-bottom: 3px;
  }
  .ms-trust-label { font-size: 10px; color: var(--ms-muted); letter-spacing: .5px; text-transform: uppercase; }
  .ms-trust-divider { width: 1px; height: 32px; background: var(--ms-border); }

  .ms-proof {
    position: relative; z-index: 1;
    display: flex; flex-direction: column; align-items: center; gap: 20px;
    padding: 72px 24px 80px;
    max-width: 1100px; margin: 0 auto;
  }
  .ms-proof-line {
    width: 60px; height: 1px;
    background: linear-gradient(90deg, transparent, var(--ms-gold), transparent);
  }
  .ms-proof-text {
    font-family: var(--ms-serif); font-size: clamp(17px, 2vw, 21px);
    font-style: italic; color: var(--ms-muted);
    text-align: center; max-width: 600px; line-height: 1.7;
  }
  .ms-proof-author { font-size: 12px; color: var(--ms-muted); letter-spacing: .5px; }

  @media (max-width: 768px) {
    .ms-wrap { grid-template-columns: 1fr; grid-template-rows: auto auto auto; gap: 0; padding: 0 20px 80px; }
    .ms-hero { grid-column: 1; grid-row: 1; padding: 56px 0 40px; }
    .ms-form-section { grid-column: 1; grid-row: 2; padding-top: 0; }
    .ms-proof { grid-column: 1; grid-row: 3; }
    .ms-form-card { padding: 28px 20px; }
    .ms-h1 { font-size: clamp(42px, 10vw, 60px); }
    .ms-subtitle { font-size: 16px; }
  }
`;

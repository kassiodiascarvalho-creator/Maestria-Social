import Link from 'next/link'

export const metadata = {
  title: 'Antes de começar · Maestria Social',
}

export default function IntroPage() {
  return (
    <>
      <style>{css}</style>
      <main className="intro-wrap">
        <div className="intro-card">

          <div className="intro-brand">
            <span className="intro-diamond">◆</span>
            <span className="intro-brand-name">Maestria Social</span>
          </div>

          <h1 className="intro-title">
            Você está prestes a<br />
            <em>descobrir seu nível</em><br />
            de Inteligência Social
          </h1>

          <p className="intro-desc">
            O diagnóstico avalia os 5 pilares que determinam seu impacto real
            sobre as pessoas ao seu redor. Seja honesto — o resultado é seu.
          </p>

          <div className="intro-pillars">
            {[
              'Sociabilidade',
              'Comunicação',
              'Relacionamento',
              'Persuasão',
              'Influência',
            ].map((p, i) => (
              <div key={p} className="intro-pillar">
                <span className="intro-pillar-n">0{i + 1}</span>
                <span className="intro-pillar-name">{p}</span>
              </div>
            ))}
          </div>

          <div className="intro-scale-box">
            <p className="intro-scale-title">Escala de resposta</p>
            <div className="intro-scale-items">
              {[
                ['1', 'Discordo totalmente'],
                ['2', 'Discordo parcialmente'],
                ['3', 'Neutro'],
                ['4', 'Concordo parcialmente'],
                ['5', 'Concordo totalmente'],
              ].map(([n, l]) => (
                <div key={n} className="intro-scale-item">
                  <div className="intro-scale-num">{n}</div>
                  <span className="intro-scale-label">{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="intro-meta">
            <span>50 questões</span>
            <span className="intro-dot">·</span>
            <span>5 pilares avaliados</span>
            <span className="intro-dot">·</span>
            <span>~8 minutos</span>
          </div>

          <Link href="/quiz" className="intro-btn">
            Iniciar diagnóstico →
          </Link>

          <p className="intro-tip">Responda com sinceridade — o diagnóstico é feito para você.</p>
        </div>
      </main>
    </>
  )
}

const css = `
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0e0f09; color:#fff9e6; font-family:'Inter',system-ui,sans-serif; min-height:100vh; }
  .intro-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:32px 20px; }
  .intro-card { width:100%; max-width:580px; background:#1a1410; border:1px solid #2a1f18; border-radius:22px; padding:48px 40px; }
  .intro-brand { display:flex; align-items:center; gap:8px; margin-bottom:28px; }
  .intro-diamond { font-size:8px; color:#c2904d; }
  .intro-brand-name { font-size:11px; font-weight:700; letter-spacing:4px; text-transform:uppercase; color:#c2904d; }
  .intro-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:clamp(32px,6vw,48px); font-weight:700; line-height:1.12; margin-bottom:18px; }
  .intro-title em { font-style:italic; color:#c2904d; }
  .intro-desc { font-size:15px; color:#7a6e5e; line-height:1.75; margin-bottom:28px; }
  .intro-pillars { display:flex; flex-direction:column; gap:8px; margin-bottom:28px; }
  .intro-pillar { display:flex; align-items:center; gap:14px; font-size:13px; padding:10px 16px; background:rgba(255,255,255,.018); border:1px solid #2a1f18; border-radius:8px; }
  .intro-pillar-n { font-family:'Cormorant Garamond',Georgia,serif; font-size:16px; font-weight:700; color:#c2904d; opacity:.5; min-width:24px; }
  .intro-pillar-name { color:#fff9e6; letter-spacing:.3px; }
  .intro-scale-box { background:rgba(194,144,77,.04); border:1px solid rgba(194,144,77,.15); border-radius:12px; padding:20px 22px; margin-bottom:28px; }
  .intro-scale-title { font-size:10px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#c2904d; margin-bottom:14px; }
  .intro-scale-items { display:flex; flex-direction:column; gap:8px; }
  .intro-scale-item { display:flex; align-items:center; gap:12px; }
  .intro-scale-num { width:28px; height:28px; border-radius:6px; background:rgba(255,255,255,.06); border:1px solid #2a1f18; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#c2904d; flex-shrink:0; }
  .intro-scale-label { font-size:13px; color:#7a6e5e; }
  .intro-meta { display:flex; align-items:center; gap:10px; font-size:12px; color:#4a3e30; margin-bottom:28px; letter-spacing:.3px; flex-wrap:wrap; }
  .intro-dot { color:#2a1f18; }
  .intro-btn { display:block; text-align:center; background:linear-gradient(135deg,#c2904d,#d4a055); color:#0e0f09; text-decoration:none; font-weight:700; font-size:16px; padding:16px 28px; border-radius:12px; margin-bottom:14px; transition:filter .2s,transform .2s; letter-spacing:.3px; }
  .intro-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
  .intro-tip { font-size:12px; color:#4a3e30; text-align:center; letter-spacing:.3px; }
  @media(max-width:540px) { .intro-card { padding:32px 20px; } }
`

import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = { quente: "#e07070", morno: "#d4a055", frio: "#7a9ec0" };
const STATUS_EMOJI: Record<string, string> = { quente: "🔴", morno: "🟡", frio: "🔵" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: lead }, { data: conversas }, { data: qualificacoes }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase.from("conversas").select("*").eq("lead_id", id).order("criado_em", { ascending: true }),
    supabase.from("qualificacoes").select("*").eq("lead_id", id).order("criado_em", { ascending: true }),
  ]);

  if (!lead) notFound();

  const pilares = [
    { key: "A", name: "Sociabilidade" },
    { key: "B", name: "Comunicação" },
    { key: "C", name: "Relacionamento" },
    { key: "D", name: "Persuasão" },
    { key: "E", name: "Influência" },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="lead-page">
        {/* Header */}
        <div className="lead-header">
          <Link href="/dashboard/leads" className="back-link">← Leads</Link>
          <div className="lead-identity">
            <div className="lead-avatar-lg">{lead.nome.charAt(0).toUpperCase()}</div>
            <div>
              <h1 className="lead-name">{lead.nome}</h1>
              <p className="lead-contact">{lead.email} · {lead.whatsapp}</p>
            </div>
          </div>
          <span className="lead-status" style={{ color: STATUS_COLOR[lead.status_lead] }}>
            {STATUS_EMOJI[lead.status_lead]} {lead.status_lead}
          </span>
        </div>

        <div className="lead-grid">
          {/* Coluna esquerda */}
          <div className="lead-col">
            {/* Score QS */}
            {lead.qs_total && (
              <div className="lead-card">
                <div className="card-label">Quociente Social</div>
                <div className="qs-display">
                  <span className="qs-num">{lead.qs_total}</span>
                  <span className="qs-den">/250</span>
                </div>
                <div className="qs-nivel">{lead.nivel_qs} · {lead.qs_percentual}%</div>
                {lead.pilar_fraco && (
                  <div className="qs-pilar">Pilar fraco: <strong>{lead.pilar_fraco}</strong></div>
                )}

                {/* Barras por pilar */}
                {lead.scores && (
                  <div className="pilares-list">
                    {pilares.map((p) => {
                      const score = (lead.scores as Record<string, number>)[p.key] ?? 0;
                      const pct = Math.round((score / 50) * 100);
                      return (
                        <div key={p.key} className="pilar-row">
                          <div className="pilar-info">
                            <span className="pilar-name">{p.name}</span>
                            <span className="pilar-score">{score}/50</span>
                          </div>
                          <div className="pilar-bar">
                            <div className="pilar-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Qualificações */}
            {qualificacoes && qualificacoes.length > 0 && (
              <div className="lead-card">
                <div className="card-label">Qualificações do Agente</div>
                <div className="quals-list">
                  {qualificacoes.map((q) => (
                    <div key={q.id} className="qual-item">
                      <span className="qual-campo">{q.campo}</span>
                      <span className="qual-valor">{q.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita — conversa */}
          <div className="lead-col">
            <div className="lead-card chat-card">
              <div className="card-label">Histórico de Conversa</div>
              {conversas && conversas.length > 0 ? (
                <div className="chat-list">
                  {conversas.map((msg) => (
                    <div key={msg.id} className={`chat-msg ${msg.role}`}>
                      <div className="chat-role">{msg.role === "assistant" ? "Agente" : "Lead"}</div>
                      <div className="chat-text">{msg.mensagem}</div>
                      <div className="chat-time">
                        {new Date(msg.criado_em).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="chat-empty">Nenhuma mensagem ainda</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const css = `
  .lead-page{padding:40px;}
  .back-link{font-size:13px;color:#7a6e5e;text-decoration:none;display:inline-block;margin-bottom:24px;transition:color .15s;}
  .back-link:hover{color:#c2904d;}
  .lead-header{display:flex;align-items:center;gap:20px;margin-bottom:36px;flex-wrap:wrap;}
  .lead-avatar-lg{width:56px;height:56px;border-radius:50%;background:rgba(194,144,77,.15);border:1px solid rgba(194,144,77,.25);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#c2904d;flex-shrink:0;}
  .lead-identity{display:flex;align-items:center;gap:16px;flex:1;}
  .lead-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:#fff9e6;}
  .lead-contact{font-size:13px;color:#7a6e5e;margin-top:4px;}
  .lead-status{font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:capitalize;}
  .lead-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  .lead-col{display:flex;flex-direction:column;gap:20px;}
  .lead-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px;}
  .chat-card{min-height:400px;display:flex;flex-direction:column;}
  .card-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;margin-bottom:16px;}
  .qs-display{display:flex;align-items:baseline;gap:4px;margin-bottom:4px;}
  .qs-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:52px;font-weight:700;color:#c2904d;line-height:1;}
  .qs-den{font-size:16px;color:#7a6e5e;}
  .qs-nivel{font-size:13px;color:#7a6e5e;margin-bottom:8px;}
  .qs-pilar{font-size:13px;color:#7a6e5e;margin-bottom:20px;}
  .qs-pilar strong{color:#fff9e6;}
  .pilares-list{display:flex;flex-direction:column;gap:12px;}
  .pilar-row{display:flex;flex-direction:column;gap:4px;}
  .pilar-info{display:flex;justify-content:space-between;align-items:center;}
  .pilar-name{font-size:12px;color:#7a6e5e;font-weight:500;}
  .pilar-score{font-size:12px;color:#c2904d;font-weight:600;}
  .pilar-bar{height:3px;background:#2a1f18;border-radius:99px;overflow:hidden;}
  .pilar-fill{height:100%;background:linear-gradient(90deg,#c2904d,#d4a055);border-radius:99px;}
  .quals-list{display:flex;flex-direction:column;gap:10px;}
  .qual-item{background:rgba(255,255,255,.02);border:1px solid #2a1f18;border-radius:10px;padding:12px 14px;}
  .qual-campo{display:block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;margin-bottom:4px;}
  .qual-valor{font-size:14px;color:#fff9e6;font-weight:300;line-height:1.5;}
  .chat-list{display:flex;flex-direction:column;gap:14px;flex:1;overflow-y:auto;max-height:500px;}
  .chat-msg{display:flex;flex-direction:column;gap:4px;max-width:85%;}
  .chat-msg.assistant{align-self:flex-start;}
  .chat-msg.user{align-self:flex-end;}
  .chat-role{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#4a3e30;}
  .chat-msg.user .chat-role{text-align:right;color:rgba(194,144,77,.5);}
  .chat-text{font-size:14px;line-height:1.65;font-weight:300;padding:12px 14px;border-radius:12px;background:#22180f;border:1px solid #2a1f18;}
  .chat-msg.user .chat-text{background:rgba(194,144,77,.08);border-color:rgba(194,144,77,.15);color:#fff9e6;}
  .chat-time{font-size:11px;color:#4a3e30;}
  .chat-msg.user .chat-time{text-align:right;}
  .chat-empty{font-size:14px;color:#4a3e30;font-style:italic;text-align:center;padding:40px 0;}
  @media(max-width:768px){.lead-grid{grid-template-columns:1fr;}.lead-page{padding:20px;}}
`;

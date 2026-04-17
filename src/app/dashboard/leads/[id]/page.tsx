import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChatInput from "./ChatInput";
import EtiquetaSelector from "./EtiquetaSelector";
import ExcluirLead from "./ExcluirLead";

const STATUS_COLOR: Record<string, string> = { quente: "#e07070", morno: "#d4a055", frio: "#7a9ec0" };
const STATUS_EMOJI: Record<string, string> = { quente: "🔴", morno: "🟡", frio: "🔵" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const [{ data: leadRaw }, { data: conversas }, { data: qualificacoes }] = await Promise.all([
    db.from("leads").select("*").eq("id", id).single(),
    supabase.from("conversas").select("*").eq("lead_id", id).order("criado_em", { ascending: true }),
    supabase.from("qualificacoes").select("*").eq("lead_id", id).order("criado_em", { ascending: true }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lead = leadRaw as any
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
              <div className="lead-contact-row">
                <span className="lead-contact-item">{lead.email}</span>
                <span className="lead-contact-sep">·</span>
                <span className="lead-contact-item">{lead.whatsapp}</span>
                {lead.instagram && <>
                  <span className="lead-contact-sep">·</span>
                  <span className="lead-contact-item lead-instagram">@{lead.instagram.replace(/^@/, '')}</span>
                </>}
                {lead.profissao && <>
                  <span className="lead-contact-sep">·</span>
                  <span className="lead-contact-item">{lead.profissao}</span>
                </>}
                {lead.renda_mensal && <>
                  <span className="lead-contact-sep">·</span>
                  <span className="lead-contact-item lead-renda">{lead.renda_mensal}</span>
                </>}
              </div>

              {/* Origem + Etiqueta */}
              <div className="lead-meta-row">
                {lead.origem && (
                  <span className="lead-origem" title="Lista de disparo de origem">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }}>
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                    </svg>
                    {lead.origem}
                  </span>
                )}
                <EtiquetaSelector leadId={id} etiquetaAtual={lead.etiqueta ?? null} />
              </div>
            </div>
          </div>
          <div className="lead-header-right">
            <span className="lead-status" style={{ color: STATUS_COLOR[lead.status_lead] }}>
              {STATUS_EMOJI[lead.status_lead]} {lead.status_lead}
            </span>
            <ExcluirLead leadId={id} nomeLocal={lead.nome} />
          </div>
        </div>

        <div className="lead-grid">
          {/* Coluna esquerda */}
          <div className="lead-col">
            {lead.qs_total && (
              <div className="lead-card">
                <div className="card-label">Quociente Social</div>
                <div className="qs-display">
                  <span className="qs-num">{lead.qs_percentual ?? lead.qs_total}</span>
                  <span className="qs-den">/100</span>
                </div>
                <div className="qs-nivel">{lead.nivel_qs} · {lead.qs_percentual}%</div>
                {lead.pilar_fraco && (
                  <div className="qs-pilar">Pilar fraco: <strong>{lead.pilar_fraco}</strong></div>
                )}
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

              {/* Mensagens */}
              <div className="chat-list custom-scroll">
                {conversas && conversas.length > 0 ? conversas.map((msg) => (
                  <div key={msg.id} className={`chat-msg ${msg.role}`}>
                    <div className="chat-role">{msg.role === "assistant" ? "Agente" : "Lead"}</div>
                    <div className="chat-text">{msg.mensagem}</div>
                    <div className="chat-time">
                      {new Date(msg.criado_em).toLocaleString("pt-BR", {
                        hour: "2-digit", minute: "2-digit",
                        day: "2-digit", month: "2-digit",
                      })}
                    </div>
                  </div>
                )) : (
                  <p className="chat-empty">Nenhuma mensagem ainda</p>
                )}
              </div>

              {/* Input de envio */}
              <ChatInput leadId={id} temConversa={!!(conversas && conversas.length > 0)} />
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
  .lead-header{display:flex;align-items:flex-start;gap:20px;margin-bottom:36px;flex-wrap:wrap;}
  .lead-header-right{display:flex;flex-direction:column;align-items:flex-end;gap:10px;margin-left:auto;}
  .excluir-btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#7a6e5e;background:transparent;border:1px solid #2a1f18;border-radius:8px;padding:5px 10px;cursor:pointer;font-family:inherit;transition:color .15s,border-color .15s;}
  .excluir-btn:hover{color:#e07070;border-color:rgba(224,112,112,.3);}
  .excluir-confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
  .excluir-aviso{font-size:13px;color:#d4c9b5;}
  .excluir-aviso strong{color:#fff9e6;}
  .excluir-sim{background:#e07070;border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:700;padding:5px 12px;cursor:pointer;font-family:inherit;transition:filter .15s;}
  .excluir-sim:hover:not(:disabled){filter:brightness(1.1);}
  .excluir-sim:disabled{opacity:.5;cursor:default;}
  .excluir-nao{background:transparent;border:1px solid #2a1f18;border-radius:8px;color:#7a6e5e;font-size:12px;padding:5px 12px;cursor:pointer;font-family:inherit;transition:color .15s;}
  .excluir-nao:hover:not(:disabled){color:#fff9e6;}
  .excluir-erro{font-size:12px;color:#e07070;}
  .lead-avatar-lg{width:56px;height:56px;border-radius:50%;background:rgba(194,144,77,.15);border:1px solid rgba(194,144,77,.25);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#c2904d;flex-shrink:0;}
  .lead-identity{display:flex;align-items:flex-start;gap:16px;flex:1;}
  .lead-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:#fff9e6;}
  .lead-status{font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:capitalize;margin-top:6px;}
  .lead-contact-row{display:flex;align-items:center;flex-wrap:wrap;gap:4px 0;margin-top:4px;}
  .lead-contact-item{font-size:13px;color:#7a6e5e;}
  .lead-contact-sep{font-size:13px;color:#4a3e30;margin:0 6px;}
  .lead-instagram{color:#9b8ec4;}
  .lead-renda{color:#7a9e7a;}

  /* Origem + Etiqueta */
  .lead-meta-row{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;}
  .lead-origem{font-size:12px;color:#9b8ec4;background:rgba(155,142,196,.08);border:1px solid rgba(155,142,196,.15);border-radius:6px;padding:3px 8px;}

  /* EtiquetaSelector */
  .etq-wrap{position:relative;display:inline-block;}
  .etq-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:4px 10px;border-radius:6px;border:1px solid;background:transparent;cursor:pointer;font-family:inherit;transition:opacity .15s;}
  .etq-badge:hover{opacity:.8;}
  .etq-caret{font-size:10px;opacity:.6;}
  .etq-dropdown{position:absolute;top:calc(100% + 6px);left:0;z-index:50;background:#1a1410;border:1px solid #2a1f18;border-radius:12px;padding:8px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:4px;}
  .etq-option{display:block;width:100%;text-align:left;background:transparent;border:none;padding:8px 10px;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;font-family:inherit;transition:background .15s;}
  .etq-option:hover:not(:disabled){background:rgba(255,255,255,.04);}
  .etq-option-ativa{background:rgba(255,255,255,.06);}
  .etq-option:disabled{opacity:.4;cursor:default;}
  .etq-custom-row{display:flex;gap:6px;margin-top:4px;border-top:1px solid #2a1f18;padding-top:8px;}
  .etq-custom-input{flex:1;background:#13100c;border:1px solid #2a1f18;border-radius:8px;padding:7px 10px;font-size:13px;color:#fff9e6;font-family:inherit;outline:none;}
  .etq-custom-input::placeholder{color:#4a3e30;}
  .etq-custom-input:focus{border-color:rgba(194,144,77,.35);}
  .etq-custom-btn{background:#c2904d;border:none;border-radius:8px;color:#0e0f09;font-size:14px;font-weight:700;width:32px;cursor:pointer;flex-shrink:0;transition:filter .15s;}
  .etq-custom-btn:hover:not(:disabled){filter:brightness(1.1);}
  .etq-custom-btn:disabled{opacity:.4;cursor:default;}
  .etq-erro{font-size:12px;color:#e07070;padding:4px 6px;}

  .lead-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  .lead-col{display:flex;flex-direction:column;gap:20px;}
  .lead-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px;}
  .chat-card{display:flex;flex-direction:column;gap:0;}
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

  /* Chat */
  .chat-list{display:flex;flex-direction:column;gap:14px;flex:1;overflow-y:auto;max-height:420px;padding-right:6px;margin-bottom:16px;}
  .chat-msg{display:flex;flex-direction:column;gap:4px;max-width:85%;}
  .chat-msg.assistant{align-self:flex-start;}
  .chat-msg.user{align-self:flex-end;}
  .chat-role{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#4a3e30;}
  .chat-msg.user .chat-role{text-align:right;color:rgba(194,144,77,.5);}
  .chat-text{font-size:14px;line-height:1.65;font-weight:300;padding:12px 14px;border-radius:12px;background:#22180f;border:1px solid #2a1f18;color:#d4c9b5;white-space:pre-wrap;}
  .chat-msg.user .chat-text{background:rgba(194,144,77,.08);border-color:rgba(194,144,77,.15);color:#fff9e6;}
  .chat-time{font-size:11px;color:#4a3e30;}
  .chat-msg.user .chat-time{text-align:right;}
  .chat-empty{font-size:14px;color:#4a3e30;font-style:italic;text-align:center;padding:40px 0;flex:1;}

  /* Scrollbar bonita */
  .custom-scroll::-webkit-scrollbar{width:4px;}
  .custom-scroll::-webkit-scrollbar-track{background:transparent;}
  .custom-scroll::-webkit-scrollbar-thumb{background:rgba(194,144,77,.2);border-radius:99px;}
  .custom-scroll::-webkit-scrollbar-thumb:hover{background:rgba(194,144,77,.4);}
  .custom-scroll{scrollbar-width:thin;scrollbar-color:rgba(194,144,77,.2) transparent;}

  /* Chat input */
  .chat-input-wrap{border-top:1px solid #2a1f18;padding-top:16px;display:flex;flex-direction:column;gap:10px;}
  .chat-bar{display:flex;align-items:flex-end;gap:10px;background:#13100c;border:1px solid #2a1f18;border-radius:14px;padding:10px 12px;transition:border-color .2s;}
  .chat-bar:focus-within{border-color:rgba(194,144,77,.35);}
  .attach-btn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;color:#4a3e30;cursor:pointer;flex-shrink:0;transition:color .15s,background .15s;}
  .attach-btn:hover{color:#c2904d;background:rgba(194,144,77,.08);}
  .chat-textarea{flex:1;background:transparent;border:none;outline:none;color:#fff9e6;font-size:14px;font-family:inherit;resize:none;line-height:1.6;max-height:120px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(194,144,77,.2) transparent;}
  .chat-textarea::placeholder{color:#4a3e30;}
  .chat-textarea::-webkit-scrollbar{width:3px;}
  .chat-textarea::-webkit-scrollbar-thumb{background:rgba(194,144,77,.2);border-radius:99px;}
  .chat-file-placeholder{flex:1;font-size:13px;color:#7a6e5e;padding:6px 0;align-self:center;}
  .send-btn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:#c2904d;border:none;color:#0e0f09;cursor:pointer;flex-shrink:0;transition:filter .15s,opacity .15s;}
  .send-btn:hover:not(:disabled){filter:brightness(1.1);}
  .send-btn:disabled{opacity:.4;cursor:default;}
  @keyframes spin{to{transform:rotate(360deg);}}

  /* Preview de arquivo */
  .chat-preview{background:#13100c;border:1px solid #2a1f18;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;position:relative;}
  .preview-img{max-height:140px;border-radius:8px;object-fit:cover;width:100%;}
  .preview-file{display:flex;align-items:center;gap:10px;}
  .preview-icon{font-size:24px;}
  .preview-name{font-size:13px;color:#7a6e5e;word-break:break-all;}
  .preview-remove{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.5);border:none;color:#fff9e6;border-radius:50%;width:22px;height:22px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;}
  .preview-remove:hover{background:rgba(200,80,80,.6);}
  .preview-caption{background:transparent;border:none;border-top:1px solid #2a1f18;outline:none;padding-top:8px;font-size:13px;color:#fff9e6;font-family:inherit;width:100%;}
  .preview-caption::placeholder{color:#4a3e30;}

  /* Erro */
  .chat-erro{font-size:12px;color:#e07070;background:rgba(224,112,112,.06);border:1px solid rgba(224,112,112,.15);border-radius:8px;padding:8px 12px;}

  /* Reenvio */
  .reenvio-wrap{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
  .reenvio-btn{background:rgba(194,144,77,.06);border:1px solid rgba(194,144,77,.2);color:#c2904d;font-size:13px;font-weight:600;padding:10px 14px;border-radius:10px;cursor:pointer;font-family:inherit;transition:background .15s,border-color .15s;text-align:left;}
  .reenvio-btn:hover:not(:disabled){background:rgba(194,144,77,.12);border-color:rgba(194,144,77,.4);}
  .reenvio-btn:disabled{opacity:.5;cursor:default;}
  .reenvio-status{font-size:12px;padding:8px 12px;border-radius:8px;}
  .reenvio-ok{color:#7ac47a;background:rgba(122,196,122,.06);border:1px solid rgba(122,196,122,.15);}
  .reenvio-erro{color:#e07070;background:rgba(224,112,112,.06);border:1px solid rgba(224,112,112,.15);word-break:break-all;}

  @media(max-width:768px){
    .lead-grid{grid-template-columns:1fr;}
    .lead-page{padding:20px;}
    .lead-contact-row{flex-direction:column;align-items:flex-start;gap:3px;}
    .lead-contact-sep{display:none;}
    .etq-dropdown{left:auto;right:0;}
  }
`;

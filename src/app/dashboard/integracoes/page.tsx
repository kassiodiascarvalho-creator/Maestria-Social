"use client";

import { useState } from "react";

export default function IntegracoesPage() {
  const [saved, setSaved] = useState<string | null>(null);

  async function saveEnv(key: string, value: string) {
    await fetch("/api/admin/env", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <>
      <style>{css}</style>
      <div className="int-page">
        <div className="int-header">
          <h1 className="int-title">Integrações</h1>
          <p className="int-sub">Configure as credenciais das APIs externas</p>
        </div>

        <div className="int-grid">
          <IntCard
            title="OpenAI"
            badge="IA / Agente SDR"
            desc="Chave de API para o modelo GPT-4.1 Mini usado pelo agente de qualificação."
            fields={[{ label: "OPENAI_API_KEY", key: "OPENAI_API_KEY", type: "password", placeholder: "sk-..." }]}
            saved={saved}
            onSave={saveEnv}
          />

          <IntCard
            title="Meta Cloud API"
            badge="WhatsApp Business"
            desc="Credenciais para envio e recebimento de mensagens via WhatsApp Business."
            fields={[
              { label: "META_VERIFY_TOKEN", key: "META_VERIFY_TOKEN", type: "text", placeholder: "Token de verificação do webhook" },
              { label: "META_ACCESS_TOKEN", key: "META_ACCESS_TOKEN", type: "password", placeholder: "EAAxx..." },
              { label: "META_PHONE_NUMBER_ID", key: "META_PHONE_NUMBER_ID", type: "text", placeholder: "ID do número de telefone" },
            ]}
            saved={saved}
            onSave={saveEnv}
          />

          <IntCard
            title="Webhook Meta"
            badge="URL de callback"
            desc="Configure esta URL no painel do Meta para receber mensagens do WhatsApp."
            fields={[]}
            saved={saved}
            onSave={saveEnv}
            webhook
          />
        </div>
      </div>
    </>
  );
}

function IntCard({
  title, badge, desc, fields, saved, onSave, webhook,
}: {
  title: string;
  badge: string;
  desc: string;
  fields: { label: string; key: string; type: string; placeholder: string }[];
  saved: string | null;
  onSave: (key: string, value: string) => void;
  webhook?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhook/meta`
    : "/api/webhook/meta";

  return (
    <div className="int-card">
      <div className="int-card-head">
        <div>
          <div className="int-badge">{badge}</div>
          <div className="int-card-title">{title}</div>
        </div>
      </div>
      <p className="int-desc">{desc}</p>

      {webhook ? (
        <div className="webhook-box">
          <div className="webhook-label">URL do Webhook</div>
          <div className="webhook-url">
            <code>{webhookUrl}</code>
            <button className="copy-btn" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
              Copiar
            </button>
          </div>
          <p className="webhook-hint">
            Cole esta URL no campo <strong>Callback URL</strong> no painel do Meta for Developers.
          </p>
        </div>
      ) : (
        <div className="int-fields">
          {fields.map((f) => (
            <div key={f.key} className="int-field">
              <label className="int-label">{f.label}</label>
              <div className="int-row">
                <input
                  className="int-input"
                  type={f.type}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                />
                <button
                  className={`int-save-btn${saved === f.key ? " saved" : ""}`}
                  onClick={() => onSave(f.key, values[f.key] ?? "")}
                  disabled={!values[f.key]}
                >
                  {saved === f.key ? "✓" : "Salvar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const css = `
  .int-page{padding:40px;}
  .int-header{margin-bottom:32px;}
  .int-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:700;color:#fff9e6;margin-bottom:6px;}
  .int-sub{font-size:14px;color:#7a6e5e;font-weight:300;}
  .int-grid{display:flex;flex-direction:column;gap:16px;}
  .int-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:28px 32px;}
  .int-card-head{margin-bottom:10px;}
  .int-badge{font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c2904d;margin-bottom:4px;}
  .int-card-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:700;color:#fff9e6;}
  .int-desc{font-size:14px;color:#7a6e5e;font-weight:300;line-height:1.6;margin-bottom:24px;}
  .int-fields{display:flex;flex-direction:column;gap:16px;}
  .int-field{display:flex;flex-direction:column;gap:6px;}
  .int-label{font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#7a6e5e;}
  .int-row{display:flex;gap:10px;}
  .int-input{flex:1;background:rgba(255,255,255,.04);border:1px solid #2a1f18;border-radius:10px;padding:11px 14px;font-size:14px;color:#fff9e6;font-family:inherit;outline:none;transition:border-color .2s;}
  .int-input::placeholder{color:#3d3328;}
  .int-input:focus{border-color:rgba(194,144,77,.4);}
  .int-save-btn{background:#c2904d;color:#0e0f09;border:none;border-radius:10px;padding:11px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;white-space:nowrap;}
  .int-save-btn:disabled{opacity:.4;cursor:not-allowed;}
  .int-save-btn.saved{background:#6acca0;color:#0a0f09;}
  .int-save-btn:hover:not(:disabled):not(.saved){filter:brightness(1.08);}
  .webhook-box{background:rgba(255,255,255,.02);border:1px solid #2a1f18;border-radius:12px;padding:18px 20px;}
  .webhook-label{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#4a3e30;margin-bottom:10px;}
  .webhook-url{display:flex;align-items:center;gap:12px;background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:12px 16px;margin-bottom:10px;}
  .webhook-url code{flex:1;font-size:13px;color:#c2904d;font-family:monospace;word-break:break-all;}
  .copy-btn{background:rgba(194,144,77,.1);border:1px solid rgba(194,144,77,.2);color:#c2904d;font-size:12px;font-weight:700;padding:6px 12px;border-radius:6px;cursor:pointer;white-space:nowrap;font-family:inherit;transition:background .15s;}
  .copy-btn:hover{background:rgba(194,144,77,.2);}
  .webhook-hint{font-size:13px;color:#7a6e5e;line-height:1.55;}
  .webhook-hint strong{color:#fff9e6;}
  @media(max-width:768px){.int-page{padding:20px;}.int-card{padding:20px;}.int-row{flex-direction:column;}}
`;

"use client";

import { useState, useEffect } from "react";

const FIELDS_CONFIG = [
  {
    title: "OpenAI",
    badge: "IA / Agente SDR",
    desc: "Chave de API para o modelo GPT-4.1 Mini usado pelo agente de qualificação.",
    fields: [
      { label: "OPENAI_API_KEY", key: "OPENAI_API_KEY", type: "password", placeholder: "sk-..." },
    ],
  },
  {
    title: "Meta Cloud API",
    badge: "WhatsApp Business",
    desc: "Credenciais para envio e recebimento de mensagens via WhatsApp Business.",
    fields: [
      { label: "META_VERIFY_TOKEN", key: "META_VERIFY_TOKEN", type: "text", placeholder: "Token de verificação do webhook" },
      { label: "META_ACCESS_TOKEN", key: "META_ACCESS_TOKEN", type: "password", placeholder: "EAAxx..." },
      { label: "META_PHONE_NUMBER_ID", key: "META_PHONE_NUMBER_ID", type: "text", placeholder: "ID do número de telefone do Maestria Social" },
      { label: "META_FORWARD_WEBHOOK_URL", key: "META_FORWARD_WEBHOOK_URL", type: "text", placeholder: "URL da outra plataforma (opcional — coexistência)" },
    ],
  },
];

export default function IntegracoesPage() {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Carregar status de cada chave
  useEffect(() => {
    const allKeys = FIELDS_CONFIG.flatMap((g) => g.fields.map((f) => f.key));
    Promise.all(
      allKeys.map((key) =>
        fetch(`/api/admin/env?key=${key}`)
          .then((r) => r.json())
          .then((d) => ({ key, defined: d.defined as boolean }))
          .catch(() => ({ key, defined: false }))
      )
    ).then((results) => {
      const s: Record<string, boolean> = {};
      results.forEach(({ key, defined }) => { s[key] = defined; });
      setStatus(s);
    });
  }, []);

  async function handleSave(key: string) {
    const value = values[key]?.trim();
    if (!value) {
      setErrors((p) => ({ ...p, [key]: "Valor não pode ser vazio" }));
      return;
    }
    setErrors((p) => ({ ...p, [key]: "" }));
    setSaving((p) => ({ ...p, [key]: true }));

    try {
      const res = await fetch("/api/admin/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error();
      setSaved((p) => ({ ...p, [key]: true }));
      setStatus((p) => ({ ...p, [key]: true }));
      setValues((p) => ({ ...p, [key]: "" }));
      setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2500);
    } catch {
      setErrors((p) => ({ ...p, [key]: "Erro ao salvar. Tente novamente." }));
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  }

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhook/meta`
    : "/api/webhook/meta";

  return (
    <>
      <style>{css}</style>
      <div className="int-page">
        <div className="int-header">
          <h1 className="int-title">Integrações</h1>
          <p className="int-sub">Configure as credenciais das APIs externas</p>
        </div>

        <div className="int-grid">
          {FIELDS_CONFIG.map((group) => (
            <div key={group.title} className="int-card">
              <div className="int-card-head">
                <div className="int-badge">{group.badge}</div>
                <div className="int-card-title">{group.title}</div>
              </div>
              <p className="int-desc">{group.desc}</p>

              <div className="int-fields">
                {group.fields.map((f) => (
                  <div key={f.key} className="int-field">
                    <div className="int-label-row">
                      <label className="int-label">{f.label}</label>
                      <span className={`int-status ${status[f.key] ? "defined" : "undefined"}`}>
                        {status[f.key] ? "✓ Configurado" : "Não configurado"}
                      </span>
                    </div>
                    <div className="int-row">
                      <input
                        className="int-input"
                        type={f.type}
                        placeholder={status[f.key] ? "••••••••••• (alterar valor)" : f.placeholder}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      />
                      <button
                        className={`int-save-btn${saved[f.key] ? " saved" : ""}`}
                        onClick={() => handleSave(f.key)}
                        disabled={saving[f.key] || !values[f.key]}
                      >
                        {saving[f.key] ? "..." : saved[f.key] ? "✓ Salvo" : "Salvar"}
                      </button>
                    </div>
                    {errors[f.key] && <span className="int-error">{errors[f.key]}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Webhook */}
          <div className="int-card">
            <div className="int-card-head">
              <div className="int-badge">URL de callback</div>
              <div className="int-card-title">Webhook Meta</div>
            </div>
            <p className="int-desc">Configure esta URL no painel do Meta for Developers para receber mensagens do WhatsApp.</p>
            <div className="webhook-box">
              <div className="webhook-label">Callback URL</div>
              <div className="webhook-url">
                <code>{webhookUrl}</code>
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                  Copiar
                </button>
              </div>
              <p className="webhook-hint">
                Cole esta URL em <strong>WhatsApp → Configuration → Webhook → Edit</strong> no painel do Meta for Developers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
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
  .int-fields{display:flex;flex-direction:column;gap:18px;}
  .int-field{display:flex;flex-direction:column;gap:6px;}
  .int-label-row{display:flex;align-items:center;justify-content:space-between;}
  .int-label{font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#7a6e5e;}
  .int-status{font-size:11px;font-weight:600;letter-spacing:.3px;}
  .int-status.defined{color:#6acca0;}
  .int-status.undefined{color:#4a3e30;}
  .int-row{display:flex;gap:10px;}
  .int-input{flex:1;background:rgba(255,255,255,.04);border:1px solid #2a1f18;border-radius:10px;padding:11px 14px;font-size:14px;color:#fff9e6;font-family:inherit;outline:none;transition:border-color .2s;}
  .int-input::placeholder{color:#4a3e30;}
  .int-input:focus{border-color:rgba(194,144,77,.4);}
  .int-save-btn{background:#c2904d;color:#0e0f09;border:none;border-radius:10px;padding:11px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;white-space:nowrap;}
  .int-save-btn:disabled{opacity:.4;cursor:not-allowed;}
  .int-save-btn.saved{background:#6acca0;color:#0e0f09;}
  .int-save-btn:hover:not(:disabled):not(.saved){filter:brightness(1.08);}
  .int-error{font-size:12px;color:#e05840;}
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

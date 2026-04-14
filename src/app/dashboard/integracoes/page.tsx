"use client";

import { useEffect, useState } from "react";

type ApiKeyItem = {
  id: string;
  nome: string;
  chave_prefixo: string;
  ativa: boolean;
  criado_em: string;
};

type WebhookItem = {
  id: string;
  evento: "novo_lead" | "lead_qualificado" | "mensagem_recebida" | "status_atualizado";
  url: string;
  secret: string | null;
  ativo: boolean;
  criado_em: string;
};

const FIELDS_CONFIG = [
  {
    title: "API do Maestria Social",
    badge: "Integração externa",
    desc: "Chave simples para autenticar sistemas externos nos endpoints /api/v1/* e /api/integracoes/*.",
    fields: [
      { label: "INTEGRACOES_API_KEY", key: "INTEGRACOES_API_KEY", type: "password", placeholder: "ms_live_..." },
    ],
  },
  {
    title: "OpenAI",
    badge: "IA / Agente SDR",
    desc: "Chave de API para o modelo usado pelo agente de qualificação.",
    fields: [
      { label: "OPENAI_API_KEY", key: "OPENAI_API_KEY", type: "password", placeholder: "sk-..." },
    ],
  },
  {
    title: "Email (Resend)",
    badge: "Funil de emails",
    desc: "Configurações de envio de email via Resend.",
    fields: [
      { label: "RESEND_API_KEY", key: "RESEND_API_KEY", type: "password", placeholder: "re_..." },
      { label: "EMAIL_FROM", key: "EMAIL_FROM", type: "text", placeholder: "Maestria Social <nao-responda@maestriasocial.com>" },
    ],
  },
  {
    title: "Meta Cloud API",
    badge: "WhatsApp Business",
    desc: "Credenciais para envio e recebimento de mensagens via WhatsApp Business.",
    fields: [
      { label: "WHATSAPP_MODE", key: "WHATSAPP_MODE", type: "text", placeholder: "meta ou coexistencia" },
      { label: "COEXISTENCIA_WEBHOOK_URL", key: "COEXISTENCIA_WEBHOOK_URL", type: "text", placeholder: "Webhook da plataforma coexistente (entrada/saída)" },
      { label: "META_VERIFY_TOKEN", key: "META_VERIFY_TOKEN", type: "text", placeholder: "Token de verificação do webhook" },
      { label: "META_ACCESS_TOKEN", key: "META_ACCESS_TOKEN", type: "password", placeholder: "EAAxx..." },
      { label: "META_PHONE_NUMBER_ID", key: "META_PHONE_NUMBER_ID", type: "text", placeholder: "ID do número do Maestria Social" },
      { label: "META_WHATSAPP_NUMBER", key: "META_WHATSAPP_NUMBER", type: "text", placeholder: "Número destino para CTA (5511...)" },
      { label: "META_TEMPLATE_NAME", key: "META_TEMPLATE_NAME", type: "text", placeholder: "Template (opcional para 1º contato)" },
      { label: "META_TEMPLATE_LANGUAGE", key: "META_TEMPLATE_LANGUAGE", type: "text", placeholder: "pt_BR (opcional)" },
      { label: "META_FORWARD_WEBHOOK_URL", key: "META_FORWARD_WEBHOOK_URL", type: "text", placeholder: "URL da outra plataforma (coexistência)" },
      { label: "META_WABA_ID", key: "META_WABA_ID", type: "text", placeholder: "ID da conta WhatsApp Business (para templates)" },
    ],
  },
  {
    title: "Z-API",
    badge: "WhatsApp (alternativo)",
    desc: "API não-oficial para envio de mensagens WhatsApp sem restrição de janela 24h. Útil para disparos em massa.",
    fields: [
      { label: "ZAPI_INSTANCE_ID", key: "ZAPI_INSTANCE_ID", type: "text", placeholder: "ID da instância Z-API" },
      { label: "ZAPI_TOKEN", key: "ZAPI_TOKEN", type: "password", placeholder: "Token da instância Z-API" },
      { label: "ZAPI_CLIENT_TOKEN", key: "ZAPI_CLIENT_TOKEN", type: "password", placeholder: "Client Token (opcional)" },
    ],
  },
  {
    title: "Baileys (Local)",
    badge: "WhatsApp (local)",
    desc: "Servidor Baileys rodando na sua máquina. Inicie o servidor local (baileys-server/INICIAR.bat) e cole a URL pública gerada pelo ngrok aqui.",
    fields: [
      { label: "BAILEYS_API_URL", key: "BAILEYS_API_URL", type: "text", placeholder: "http://localhost:3001 ou URL do ngrok" },
    ],
  },
];

const EVENTOS = [
  { id: "novo_lead", label: "novo_lead" },
  { id: "lead_qualificado", label: "lead_qualificado" },
  { id: "mensagem_recebida", label: "mensagem_recebida" },
  { id: "status_atualizado", label: "status_atualizado" },
] as const;

export default function IntegracoesPage() {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyPlain, setApiKeyPlain] = useState("");
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [webhookEvento, setWebhookEvento] = useState<WebhookItem["evento"]>("novo_lead");
  const [webhookUrlNew, setWebhookUrlNew] = useState("");
  const [webhookSecretNew, setWebhookSecretNew] = useState("");
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);

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
      results.forEach(({ key, defined }) => {
        s[key] = defined;
      });
      setStatus(s);
    });

    loadApiKeys();
    loadWebhooks();
  }, []);

  async function loadApiKeys() {
    setLoadingApiKeys(true);
    try {
      const res = await fetch("/api/admin/integracoes/api-keys");
      const data = await res.json();
      if (res.ok) setApiKeys(data.api_keys ?? []);
    } finally {
      setLoadingApiKeys(false);
    }
  }

  async function loadWebhooks() {
    setLoadingWebhooks(true);
    try {
      const res = await fetch("/api/admin/integracoes/webhooks");
      const data = await res.json();
      if (res.ok) setWebhooks(data.webhooks ?? []);
    } finally {
      setLoadingWebhooks(false);
    }
  }

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

  async function createApiKey() {
    const nome = apiKeyName.trim();
    if (!nome) return;
    const res = await fetch("/api/admin/integracoes/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setApiKeyPlain(data.plain_key ?? "");
    setApiKeyName("");
    await loadApiKeys();
  }

  async function toggleApiKey(id: string, ativa: boolean) {
    await fetch(`/api/admin/integracoes/api-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativa: !ativa }),
    });
    await loadApiKeys();
  }

  async function createWebhook() {
    const url = webhookUrlNew.trim();
    if (!url) return;
    const res = await fetch("/api/admin/integracoes/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evento: webhookEvento, url, secret: webhookSecretNew.trim() }),
    });
    if (!res.ok) return;
    setWebhookUrlNew("");
    setWebhookSecretNew("");
    await loadWebhooks();
  }

  async function toggleWebhook(id: string, ativo: boolean) {
    await fetch(`/api/admin/integracoes/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !ativo }),
    });
    await loadWebhooks();
  }

  async function removeWebhook(id: string) {
    await fetch(`/api/admin/integracoes/webhooks/${id}`, { method: "DELETE" });
    await loadWebhooks();
  }

  const webhookUrlMeta =
    typeof window !== "undefined" ? `${window.location.origin}/api/webhook/meta` : "/api/webhook/meta";

  return (
    <>
      <style>{css}</style>
      <div className="int-page">
        <div className="int-header">
          <h1 className="int-title">Integrações</h1>
          <p className="int-sub">Configure credenciais, API keys e webhooks externos</p>
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

          <div className="int-card">
            <div className="int-card-head">
              <div className="int-badge">Meta Webhook</div>
              <div className="int-card-title">Callback URL</div>
            </div>
            <div className="webhook-url">
              <code>{webhookUrlMeta}</code>
              <button className="copy-btn" onClick={() => navigator.clipboard.writeText(webhookUrlMeta)}>
                Copiar
              </button>
            </div>
          </div>

          <div className="int-card">
            <div className="int-card-head">
              <div className="int-badge">API Externa</div>
              <div className="int-card-title">Endpoints públicos com API Key</div>
            </div>
            <div className="webhook-box">
              <div className="webhook-hint"><code>GET /api/v1/leads</code> e <code>POST /api/v1/leads</code></div>
              <div className="webhook-hint"><code>GET /api/integracoes/leads</code> e <code>POST /api/integracoes/leads</code></div>
              <div className="webhook-hint"><code>POST /api/integracoes/mensagens</code></div>
            </div>
          </div>

          <div className="int-card">
            <div className="int-card-head">
              <div className="int-badge">API Keys</div>
              <div className="int-card-title">Gestão de chaves por sistema</div>
            </div>
            <div className="int-row">
              <input
                className="int-input"
                placeholder="Nome da integração (ex: CRM)"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
              />
              <button className="int-save-btn" onClick={createApiKey} disabled={!apiKeyName.trim()}>
                Criar chave
              </button>
            </div>
            {apiKeyPlain && (
              <div className="webhook-box" style={{ marginTop: 12 }}>
                <div className="webhook-label">Nova chave gerada (copie agora)</div>
                <div className="webhook-url">
                  <code>{apiKeyPlain}</code>
                  <button className="copy-btn" onClick={() => navigator.clipboard.writeText(apiKeyPlain)}>
                    Copiar
                  </button>
                </div>
              </div>
            )}
            <div className="table-wrap">
              {loadingApiKeys ? (
                <p className="empty">Carregando chaves...</p>
              ) : apiKeys.length === 0 ? (
                <p className="empty">Nenhuma API key criada.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Prefixo</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((k) => (
                      <tr key={k.id}>
                        <td>{k.nome}</td>
                        <td><code>{k.chave_prefixo}...</code></td>
                        <td>{k.ativa ? "Ativa" : "Inativa"}</td>
                        <td>
                          <button className="mini-btn" onClick={() => toggleApiKey(k.id, k.ativa)}>
                            {k.ativa ? "Desativar" : "Ativar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="int-card">
            <div className="int-card-head">
              <div className="int-badge">Webhooks de saída</div>
              <div className="int-card-title">Gestão de destinos de evento</div>
            </div>
            <div className="int-fields">
              <div className="int-row">
                <select className="int-input" value={webhookEvento} onChange={(e) => setWebhookEvento(e.target.value as WebhookItem["evento"])}>
                  {EVENTOS.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
                <input
                  className="int-input"
                  placeholder="https://seu-sistema.com/webhook"
                  value={webhookUrlNew}
                  onChange={(e) => setWebhookUrlNew(e.target.value)}
                />
              </div>
              <div className="int-row">
                <input
                  className="int-input"
                  placeholder="Secret HMAC (opcional)"
                  value={webhookSecretNew}
                  onChange={(e) => setWebhookSecretNew(e.target.value)}
                />
                <button className="int-save-btn" onClick={createWebhook} disabled={!webhookUrlNew.trim()}>
                  Adicionar webhook
                </button>
              </div>
            </div>
            <div className="table-wrap">
              {loadingWebhooks ? (
                <p className="empty">Carregando webhooks...</p>
              ) : webhooks.length === 0 ? (
                <p className="empty">Nenhum webhook configurado.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Evento</th>
                      <th>URL</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((w) => (
                      <tr key={w.id}>
                        <td><code>{w.evento}</code></td>
                        <td className="url-cell">{w.url}</td>
                        <td>{w.ativo ? "Ativo" : "Inativo"}</td>
                        <td className="action-cell">
                          <button className="mini-btn" onClick={() => toggleWebhook(w.id, w.ativo)}>
                            {w.ativo ? "Pausar" : "Ativar"}
                          </button>
                          <button className="mini-btn danger" onClick={() => removeWebhook(w.id)}>
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
  .int-fields{display:flex;flex-direction:column;gap:10px;}
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
  select.int-input{appearance:none;background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23c2904d' d='M6 8L0 0h12z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:38px;cursor:pointer;}
  select.int-input option{background:#1a1410;color:#fff9e6;padding:8px;}
  select.int-input option:checked{background:#c2904d;color:#0e0f09;}
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
  .table-wrap{overflow-x:auto;margin-top:12px;border:1px solid #2a1f18;border-radius:10px;}
  .table{width:100%;border-collapse:collapse;font-size:13px;}
  .table th{background:#111009;color:#4a3e30;font-size:11px;letter-spacing:1px;text-transform:uppercase;text-align:left;padding:10px 12px;}
  .table td{padding:10px 12px;border-top:1px solid rgba(42,31,24,.5);}
  .table code{color:#c2904d;}
  .mini-btn{background:rgba(194,144,77,.08);border:1px solid rgba(194,144,77,.25);color:#c2904d;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;}
  .mini-btn.danger{border-color:rgba(224,88,64,.3);color:#e05840;background:rgba(224,88,64,.08);}
  .action-cell{display:flex;gap:8px;}
  .url-cell{max-width:340px;word-break:break-all;color:#7a6e5e;}
  .empty{font-size:13px;color:#7a6e5e;padding:12px;}
  @media(max-width:768px){
    .int-page{padding:16px;}
    .int-card{padding:18px 16px;}
    .int-title{font-size:24px;}
    .int-row{flex-direction:column;}
    .int-row .int-input{width:100%;}
    .int-save-btn{width:100%;}
    .webhook-url{flex-direction:column;gap:8px;}
    .webhook-url code{word-break:break-all;}
    .copy-btn{align-self:flex-start;}

    /* Tabelas viram cards no mobile */
    .table-wrap{overflow-x:hidden;border:none;background:transparent;border-radius:0;}
    .table{display:block;}
    .table thead{display:none;}
    .table tbody{display:flex;flex-direction:column;gap:8px;}
    .table tr{display:flex;flex-direction:column;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:12px 14px;gap:6px;}
    .table td{display:block;border-top:none;padding:0;font-size:13px;color:#7a6e5e;}
    .table td:first-child{font-weight:600;color:#fff9e6;}
    .table code{color:#c2904d;font-size:12px;}
    .url-cell{max-width:none;word-break:break-all;font-size:11px;color:#5a4e3e;}
    .action-cell{display:flex;flex-direction:row;gap:6px;margin-top:4px;}
  }
`;

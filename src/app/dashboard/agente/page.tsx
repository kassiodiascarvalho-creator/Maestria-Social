"use client";

import { useState, useEffect } from "react";

const MODELS = [
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", desc: "Rápido, eficiente e econômico. Ideal para volume alto de conversas.", cost: "Baixo custo" },
  { id: "gpt-4.1", name: "GPT-4.1", desc: "Alta capacidade de raciocínio e contexto longo. Melhor qualidade.", cost: "Custo médio" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Modelo multimodal da OpenAI. Excelente equilíbrio custo-benefício.", cost: "Custo médio" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "Versão compacta do GPT-4o. Ótimo para respostas rápidas.", cost: "Baixo custo" },
];

const DEFAULT_PROMPT = `Você é um consultor especialista em Inteligência Social do Método Maestria Social.
Seu papel é conduzir uma conversa de sondagem via WhatsApp para entender a situação do lead e qualificá-lo.

REGRAS DE COMPORTAMENTO:
1. Seja direto, empático e sofisticado — nunca genérico ou robótico
2. Faça UMA pergunta por vez — nunca duas seguidas
3. Use o nome do lead com naturalidade, mas não em toda mensagem
4. Mensagens curtas: máximo 3 parágrafos no WhatsApp
5. Adapte a próxima pergunta com base na resposta anterior
6. Após 3-4 trocas, avalie o nível de interesse e classifique o lead

CLASSIFICAÇÃO DE TEMPERATURA:
- 🔴 Frio: sem interesse claro, respostas curtas, sem dor identificada
- 🟡 Morno: interesse presente mas sem urgência, dor identificada
- 🟢 Quente: dor clara, urgência presente, aberto a soluções

AO FINAL DE CADA RESPOSTA, inclua um bloco JSON separado por "---JSON---":
---JSON---
{
  "status_lead": "frio|morno|quente",
  "qualificacoes": [
    { "campo": "maior_dor|contexto|interesse|objecao|objetivo|urgencia|outro", "valor": "texto extraído" }
  ]
}
---JSON---`;

export default function AgentePage() {
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState("0.2");
  const [ativo, setAtivo] = useState(true);
  const [modelo, setModelo] = useState("gpt-4.1-mini");
  const [phoneId, setPhoneId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const keys = ["AGENT_SYSTEM_PROMPT", "AGENT_TEMPERATURE", "AGENT_ATIVO", "AGENT_MODEL", "META_PHONE_NUMBER_ID"];
      const results = await Promise.all(
        keys.map((k) =>
          fetch(`/api/admin/env?key=${k}`)
            .then((r) => r.json())
            .catch(() => ({ defined: false }))
        )
      );
      // Buscar valores reais via endpoint GET com valor
      const vals = await Promise.all(
        keys.map((k) =>
          fetch(`/api/admin/env/value?key=${k}`)
            .then((r) => r.json())
            .catch(() => ({ value: null }))
        )
      );
      if (vals[0].value) setPrompt(vals[0].value);
      else setPrompt(DEFAULT_PROMPT);
      if (vals[1].value) setTemperature(vals[1].value);
      if (vals[2].value) setAtivo(vals[2].value !== "false");
      if (vals[3].value) setModelo(vals[3].value);
      if (vals[4].value) setPhoneId(vals[4].value);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await Promise.all([
        fetch("/api/admin/env", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "AGENT_SYSTEM_PROMPT", value: prompt }) }),
        fetch("/api/admin/env", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "AGENT_TEMPERATURE", value: temperature }) }),
        fetch("/api/admin/env", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "AGENT_ATIVO", value: String(ativo) }) }),
        fetch("/api/admin/env", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "AGENT_MODEL", value: modelo }) }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function resetPrompt() {
    setPrompt(DEFAULT_PROMPT);
  }

  if (loading) return <div className="agente-loading">Carregando configurações…</div>;

  return (
    <>
      <style>{css}</style>
      <div className="agente-page">
        <div className="agente-header">
          <div>
            <h1 className="agente-title">Agente SDR</h1>
            <p className="agente-sub">Configure o comportamento do agente de qualificação via WhatsApp</p>
          </div>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : saved ? "✓ Salvo" : "Salvar configurações"}
          </button>
        </div>

        {error && <div className="agente-error">{error}</div>}

        <div className="agente-grid">
          {/* Status */}
          <div className="agente-card">
            <div className="card-label">Status</div>
            <div className="toggle-row">
              <div>
                <div className="toggle-title">Agente ativo</div>
                <div className="toggle-desc">Quando desativado, o agente não responde mensagens</div>
              </div>
              <button
                className={`toggle-btn ${ativo ? "on" : "off"}`}
                onClick={() => setAtivo((v) => !v)}
              >
                <span className="toggle-knob" />
              </button>
            </div>
          </div>

          {/* Conexão Meta */}
          <div className="agente-card">
            <div className="card-label">Conexão WhatsApp</div>
            <div className="conn-row">
              <span className={`conn-dot ${phoneId ? "ok" : "nok"}`} />
              <div>
                <div className="conn-title">{phoneId ? "Número conectado" : "Número não configurado"}</div>
                {phoneId && <div className="conn-id">Phone Number ID: {phoneId}</div>}
              </div>
            </div>
            {!phoneId && (
              <p className="conn-hint">Configure o <strong>META_PHONE_NUMBER_ID</strong> na aba Integrações.</p>
            )}
          </div>

          {/* Temperatura */}
          <div className="agente-card full">
            <div className="card-label">Temperatura do modelo</div>
            <p className="card-desc">
              Controla a criatividade das respostas. Valores baixos (0.1–0.3) geram respostas mais previsíveis e consistentes. Valores altos (0.7–1.0) geram respostas mais variadas.
            </p>
            <div className="temp-row">
              <input
                className="temp-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
              <div className="temp-labels">
                <span>Preciso (0.0)</span>
                <span className="temp-val">{parseFloat(temperature).toFixed(2)}</span>
                <span>Criativo (1.0)</span>
              </div>
              <div className="temp-presets">
                {[["0.1", "Muito preciso"], ["0.2", "Preciso"], ["0.5", "Equilibrado"], ["0.7", "Criativo"]].map(([v, l]) => (
                  <button key={v} className={`preset-btn ${temperature === v ? "active" : ""}`} onClick={() => setTemperature(v)}>
                    {l} ({v})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Prompt */}
          <div className="agente-card full">
            <div className="prompt-header">
              <div>
                <div className="card-label">Prompt do sistema</div>
                <p className="card-desc">Define a personalidade, regras e comportamento do agente. Editável diretamente.</p>
              </div>
              <button className="reset-btn" onClick={resetPrompt}>↺ Restaurar padrão</button>
            </div>
            <textarea
              className="prompt-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={20}
              spellCheck={false}
            />
            <div className="prompt-chars">{prompt.length} caracteres</div>
          </div>

          {/* Modelo */}
          <div className="agente-card full">
            <div className="card-label">Modelo de IA</div>
            <p className="card-desc">Escolha o modelo usado pelo agente. Modelos mais capazes geram respostas melhores, mas custam mais por token.</p>
            <div className="models-grid">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  className={`model-card ${modelo === m.id ? "active" : ""}`}
                  onClick={() => setModelo(m.id)}
                >
                  <div className="model-name">{m.name}</div>
                  <div className="model-desc">{m.desc}</div>
                  <div className="model-cost">{m.cost}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const css = `
  .agente-loading{padding:40px;color:#7a6e5e;font-size:14px;}
  .agente-page{padding:40px;}
  .agente-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:32px;flex-wrap:wrap;}
  .agente-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:700;color:#fff9e6;margin-bottom:6px;}
  .agente-sub{font-size:14px;color:#7a6e5e;font-weight:300;}
  .agente-error{background:rgba(224,88,64,.1);border:1px solid rgba(224,88,64,.3);border-radius:10px;padding:12px 16px;font-size:14px;color:#e05840;margin-bottom:20px;}
  .save-btn{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:12px;padding:13px 28px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;white-space:nowrap;}
  .save-btn:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px);}
  .save-btn:disabled{opacity:.6;cursor:not-allowed;}
  .agente-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .agente-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px 28px;}
  .agente-card.full{grid-column:1/-1;}
  .card-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;margin-bottom:12px;}
  .card-desc{font-size:13px;color:#7a6e5e;line-height:1.6;font-weight:300;margin-bottom:16px;}
  .toggle-row{display:flex;align-items:center;justify-content:space-between;gap:16px;}
  .toggle-title{font-size:14px;font-weight:600;color:#fff9e6;margin-bottom:4px;}
  .toggle-desc{font-size:12px;color:#7a6e5e;}
  .toggle-btn{width:48px;height:26px;border-radius:99px;border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;}
  .toggle-btn.on{background:#c2904d;}
  .toggle-btn.off{background:#2a1f18;}
  .toggle-knob{position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff9e6;transition:left .2s;}
  .toggle-btn.on .toggle-knob{left:25px;}
  .toggle-btn.off .toggle-knob{left:3px;}
  .conn-row{display:flex;align-items:center;gap:12px;}
  .conn-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .conn-dot.ok{background:#6acca0;box-shadow:0 0 6px rgba(106,204,160,.4);}
  .conn-dot.nok{background:#4a3e30;}
  .conn-title{font-size:14px;font-weight:600;color:#fff9e6;margin-bottom:2px;}
  .conn-id{font-size:12px;color:#7a6e5e;font-family:monospace;}
  .conn-hint{font-size:13px;color:#7a6e5e;margin-top:12px;line-height:1.5;}
  .conn-hint strong{color:#c2904d;}
  .temp-row{display:flex;flex-direction:column;gap:10px;}
  .temp-slider{width:100%;accent-color:#c2904d;cursor:pointer;}
  .temp-labels{display:flex;justify-content:space-between;font-size:12px;color:#7a6e5e;}
  .temp-val{font-size:14px;font-weight:700;color:#c2904d;}
  .temp-presets{display:flex;gap:8px;flex-wrap:wrap;}
  .preset-btn{background:rgba(255,255,255,.03);border:1px solid #2a1f18;border-radius:8px;padding:7px 14px;font-size:12px;color:#7a6e5e;cursor:pointer;font-family:inherit;transition:all .15s;}
  .preset-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .preset-btn.active{background:rgba(194,144,77,.1);border-color:rgba(194,144,77,.3);color:#c2904d;font-weight:600;}
  .prompt-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:4px;}
  .reset-btn{background:none;border:1px solid #2a1f18;border-radius:8px;padding:7px 14px;font-size:12px;color:#7a6e5e;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .reset-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .prompt-textarea{width:100%;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:16px;font-size:13px;color:#fff9e6;font-family:monospace;line-height:1.7;resize:vertical;outline:none;transition:border-color .2s;}
  .prompt-textarea:focus{border-color:rgba(194,144,77,.3);}
  .prompt-chars{font-size:11px;color:#4a3e30;text-align:right;margin-top:6px;}
  .models-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;}
  .model-card{background:rgba(255,255,255,.02);border:1px solid #2a1f18;border-radius:12px;padding:16px 18px;text-align:left;cursor:pointer;font-family:inherit;transition:all .15s;}
  .model-card:hover{border-color:rgba(194,144,77,.3);background:rgba(194,144,77,.04);}
  .model-card.active{border-color:#c2904d;background:rgba(194,144,77,.08);}
  .model-name{font-size:14px;font-weight:700;color:#fff9e6;margin-bottom:4px;}
  .model-card.active .model-name{color:#c2904d;}
  .model-desc{font-size:12px;color:#7a6e5e;line-height:1.5;margin-bottom:8px;font-weight:300;}
  .model-cost{font-size:11px;font-weight:700;letter-spacing:.5px;color:#4a3e30;text-transform:uppercase;}
  .model-card.active .model-cost{color:rgba(194,144,77,.6);}
  @media(max-width:768px){.agente-grid{grid-template-columns:1fr;}.agente-page{padding:20px;}.agente-header{flex-direction:column;}}
`;

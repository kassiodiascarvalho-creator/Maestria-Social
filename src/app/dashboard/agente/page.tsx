"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const MODELS = [
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", desc: "Rápido e econômico. Ideal para volume alto.", cost: "Baixo custo" },
  { id: "gpt-4.1", name: "GPT-4.1", desc: "Alta capacidade e contexto longo. Melhor qualidade.", cost: "Custo médio" },
  { id: "gpt-4o", name: "GPT-4o", desc: "Multimodal da OpenAI. Excelente equilíbrio.", cost: "Custo médio" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "Compacto e rápido. Ótimo para respostas curtas.", cost: "Baixo custo" },
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

type Canal = { provider: "meta" | "baileys"; id: string };
type CanalDisponivel = { provider: "meta" | "baileys"; id: string; label: string; phone?: string | null; conectado: boolean };

type AgenteConfig = {
  escassez_max_dias?: number;
  escassez_max_slots?: number;
  pausa_sequencia_seg?: number;
};

type Agente = {
  id: string;
  nome: string;
  descricao: string;
  prompt: string;
  temperatura: number;
  modelo: string;
  ativo: boolean;
  canais: Canal[];
  link_agendamento: string | null;
  config?: AgenteConfig;
};

type AudioAgente = {
  id: string;
  nome: string;
  url: string;
  tamanho: number | null;
  mimetype: string;
  criado_em: string;
};

export default function AgentePage() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [selecionado, setSelecionado] = useState<Agente | null>(null);
  const [canaisDisponiveis, setCanaisDisponiveis] = useState<CanalDisponivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [criando, setCriando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [error, setError] = useState("");
  const [vistaLista, setVistaLista] = useState(true); // mobile: alterna entre lista e editor

  // Áudios
  const [audios, setAudios] = useState<AudioAgente[]>([]);
  const [loadingAudios, setLoadingAudios] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioNome, setAudioNome] = useState("");
  const [audioError, setAudioError] = useState("");
  const audioInputRef = useRef<HTMLInputElement>(null);

  const carregarCanaisDisponiveis = useCallback(async () => {
    const canais: CanalDisponivel[] = [];

    // Todas as instâncias Meta cadastradas em whatsapp_instancias
    const instRes = await fetch("/api/admin/whatsapp/instancias").then(r => r.json()).catch(() => []);
    if (Array.isArray(instRes)) {
      for (const inst of instRes) {
        if (inst.tipo === "meta" && inst.meta_phone_number_id) {
          canais.push({
            provider: "meta",
            id: inst.meta_phone_number_id,
            label: inst.label,
            phone: inst.phone ?? inst.meta_phone_number_id,
            conectado: true,
          });
        }
      }
    }

    // Fallback: Meta da config global (se não houver nenhuma instância cadastrada)
    if (!canais.some(c => c.provider === "meta")) {
      const metaRes = await fetch("/api/admin/env/value?key=META_PHONE_NUMBER_ID").then(r => r.json()).catch(() => ({ value: null }));
      if (metaRes.value) {
        canais.push({ provider: "meta", id: metaRes.value, label: "Meta API Oficial", phone: metaRes.value, conectado: true });
      }
    }

    // Instâncias Baileys
    const baileysRes = await fetch("/api/admin/wpp/baileys-status").then(r => r.json()).catch(() => []);
    if (Array.isArray(baileysRes)) {
      for (const inst of baileysRes) {
        canais.push({ provider: "baileys", id: inst.id, label: inst.label, phone: inst.phone ? `+${inst.phone}` : null, conectado: inst.connected });
      }
    }

    setCanaisDisponiveis(canais);
  }, []);

  const carregarAudios = useCallback(async (agenteId: string) => {
    setLoadingAudios(true);
    const res = await fetch(`/api/admin/agentes/${agenteId}/audios`).then(r => r.json()).catch(() => []);
    setAudios(Array.isArray(res) ? res : []);
    setLoadingAudios(false);
  }, []);

  async function uploadAudio(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selecionado || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (!audioNome.trim()) { setAudioError("Digite um nome para o áudio antes de selecionar o arquivo."); e.target.value = ""; return; }
    setAudioError("");
    setUploadingAudio(true);
    const form = new FormData();
    form.append("file", file);
    form.append("nome", audioNome.trim());
    const res = await fetch(`/api/admin/agentes/${selecionado.id}/audios`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) { setAudioError(data.error || "Erro ao fazer upload"); } else { setAudios(prev => [...prev, data]); setAudioNome(""); }
    setUploadingAudio(false);
    e.target.value = "";
  }

  async function deletarAudio(audioId: string) {
    if (!selecionado) return;
    const res = await fetch(`/api/admin/agentes/${selecionado.id}/audios`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioId }) });
    if (res.ok) setAudios(prev => prev.filter(a => a.id !== audioId));
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      const agentesRes = await fetch("/api/admin/agentes").then(r => r.json()).catch(() => []);
      const lista: Agente[] = Array.isArray(agentesRes) ? agentesRes : [];
      setAgentes(lista);
      if (lista.length > 0) {
        setSelecionado(lista[0]);
        await carregarAudios(lista[0].id);
      }
      await carregarCanaisDisponiveis();
      setLoading(false);
    }
    load();
  }, [carregarCanaisDisponiveis, carregarAudios]);

  async function criarAgente() {
    setCriando(true);
    setError("");
    const res = await fetch("/api/admin/agentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Novo Agente", prompt: DEFAULT_PROMPT, temperatura: 0.2, modelo: "gpt-4.1-mini", ativo: true, canais: [] }),
    });
    const novo = await res.json();
    if (!res.ok) { setError(novo.error || "Erro ao criar agente"); setCriando(false); return; }
    setAgentes(prev => [...prev, novo]);
    setSelecionado(novo);
    setVistaLista(false);
    setCriando(false);
  }

  async function salvar() {
    if (!selecionado) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/agentes/${selecionado.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selecionado),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Erro ao salvar"); setSaving(false); return; }
    setAgentes(prev => prev.map(a => a.id === data.id ? data : a));
    setSelecionado(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  }

  async function excluir() {
    if (!selecionado) return;
    setExcluindo(true);
    const res = await fetch(`/api/admin/agentes/${selecionado.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Erro ao excluir"); setExcluindo(false); setConfirmarExclusao(false); return; }
    const novos = agentes.filter(a => a.id !== selecionado.id);
    setAgentes(novos);
    setSelecionado(novos[0] || null);
    setConfirmarExclusao(false);
    setExcluindo(false);
    setVistaLista(true);
  }

  function update(campo: Partial<Agente>) {
    setSelecionado(prev => prev ? { ...prev, ...campo } : prev);
  }

  function updateConfig(campo: Partial<AgenteConfig>) {
    setSelecionado(prev => prev ? { ...prev, config: { ...(prev.config ?? {}), ...campo } } : prev);
  }

  function toggleCanal(canal: CanalDisponivel) {
    if (!selecionado) return;
    const canais = selecionado.canais || [];
    const jaEsta = canais.some(c => c.provider === canal.provider && c.id === canal.id);
    update({ canais: jaEsta ? canais.filter(c => !(c.provider === canal.provider && c.id === canal.id)) : [...canais, { provider: canal.provider, id: canal.id }] });
  }

  function canalAtivo(canal: CanalDisponivel) {
    return (selecionado?.canais || []).some(c => c.provider === canal.provider && c.id === canal.id);
  }

  if (loading) return <div className="agente-loading">Carregando…</div>;

  return (
    <>
      <style>{css}</style>
      <div className="ag-root">

        {/* ── Sidebar lista ── */}
        <aside className={`ag-sidebar ${!vistaLista ? "ag-sidebar-hidden" : ""}`}>
          <div className="ag-sidebar-header">
            <h1 className="ag-title">Agentes SDR</h1>
            <p className="ag-sub">Configure agentes de qualificação</p>
          </div>

          <div className="ag-list">
            {agentes.map(ag => (
              <button
                key={ag.id}
                className={`ag-item ${selecionado?.id === ag.id ? "ag-item-ativo" : ""}`}
                onClick={() => { setSelecionado(ag); setVistaLista(false); setConfirmarExclusao(false); setError(""); setAudioError(""); setAudioNome(""); carregarAudios(ag.id); }}
              >
                <span className={`ag-status-dot ${ag.ativo ? "dot-on" : "dot-off"}`} />
                <div className="ag-item-info">
                  <span className="ag-item-nome">{ag.nome}</span>
                  <span className="ag-item-canais">
                    {ag.canais?.length ? `${ag.canais.length} canal(is)` : "Sem canais"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <button className="ag-novo-btn" onClick={criarAgente} disabled={criando}>
            {criando ? "Criando…" : "+ Novo agente"}
          </button>
        </aside>

        {/* ── Editor ── */}
        <main className={`ag-editor ${vistaLista ? "ag-editor-hidden" : ""}`}>
          {!selecionado ? (
            <div className="ag-empty">
              <p>Selecione um agente ou crie um novo.</p>
            </div>
          ) : (
            <>
              {/* Header mobile */}
              <div className="ag-editor-header">
                <button className="ag-back-btn" onClick={() => setVistaLista(true)}>← Agentes</button>
                <div className="ag-editor-actions">
                  <button className="ag-excluir-btn" onClick={() => setConfirmarExclusao(true)} disabled={excluindo || agentes.length <= 1}>
                    Excluir
                  </button>
                  <button className="ag-salvar-btn" onClick={salvar} disabled={saving}>
                    {saving ? "Salvando…" : saved ? "✓ Salvo" : "Salvar"}
                  </button>
                </div>
              </div>

              {error && <div className="ag-error">{error}</div>}

              {confirmarExclusao && (
                <div className="ag-confirm">
                  <p>Tem certeza que deseja excluir <strong>{selecionado.nome}</strong>?</p>
                  <div className="ag-confirm-btns">
                    <button onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
                    <button className="btn-danger" onClick={excluir} disabled={excluindo}>
                      {excluindo ? "Excluindo…" : "Sim, excluir"}
                    </button>
                  </div>
                </div>
              )}

              <div className="ag-form">
                {/* Nome e status */}
                <div className="ag-card">
                  <div className="ag-card-label">Identidade</div>
                  <div className="ag-nome-row">
                    <input
                      className="ag-nome-input"
                      value={selecionado.nome}
                      onChange={e => update({ nome: e.target.value })}
                      placeholder="Nome do agente"
                    />
                    <button
                      className={`ag-toggle ${selecionado.ativo ? "tog-on" : "tog-off"}`}
                      onClick={() => update({ ativo: !selecionado.ativo })}
                      title={selecionado.ativo ? "Agente ativo" : "Agente inativo"}
                    >
                      <span className="tog-knob" />
                    </button>
                    <span className="ag-toggle-label">{selecionado.ativo ? "Ativo" : "Inativo"}</span>
                  </div>
                  <input
                    className="ag-desc-input"
                    value={selecionado.descricao}
                    onChange={e => update({ descricao: e.target.value })}
                    placeholder="Descrição (opcional)"
                  />
                </div>

                {/* Canais */}
                <div className="ag-card">
                  <div className="ag-card-label">Canais</div>
                  <p className="ag-card-desc">Selecione em quais números este agente responde. Um canal só pode pertencer a um agente.</p>
                  {canaisDisponiveis.length === 0 ? (
                    <p className="ag-canal-vazio">Nenhum número disponível. Configure a Meta API ou inicie o servidor Baileys.</p>
                  ) : (
                    <div className="ag-canais">
                      {canaisDisponiveis.map(canal => {
                        const ativo = canalAtivo(canal);
                        return (
                          <button
                            key={`${canal.provider}-${canal.id}`}
                            className={`ag-canal ${ativo ? "canal-on" : ""} ${!canal.conectado ? "canal-off" : ""}`}
                            onClick={() => canal.conectado && toggleCanal(canal)}
                          >
                            <div className="ag-canal-top">
                              <span className={`ag-canal-dot ${canal.conectado ? "dot-green" : "dot-gray"}`} />
                              <span className="ag-canal-provider">{canal.provider === "meta" ? "Meta API" : "Baileys"}</span>
                              {ativo && <span className="ag-canal-check">✓</span>}
                            </div>
                            <div className="ag-canal-nome">{canal.label}</div>
                            {canal.phone && <div className="ag-canal-phone">{canal.phone}</div>}
                            {!canal.conectado && <div className="ag-canal-offline">Offline</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Link de agendamento */}
                <div className="ag-card">
                  <div className="ag-card-label">Link de agendamento</div>
                  <p className="ag-card-desc">
                    Quando o lead quiser agendar, este agente enviará este link. Use <code>{"{{link_agendamento}}"}</code> no prompt para injetar automaticamente.
                  </p>
                  <input
                    className="ag-link-input"
                    value={selecionado.link_agendamento || ""}
                    onChange={e => update({ link_agendamento: e.target.value || null })}
                    placeholder="https://www.maestriasocial.com/agendar/nome-do-mentor"
                    type="url"
                  />
                </div>

                {/* Temperatura */}
                <div className="ag-card">
                  <div className="ag-card-label">Temperatura</div>
                  <p className="ag-card-desc">Controla a criatividade. Baixo = consistente. Alto = criativo.</p>
                  <div className="ag-temp-row">
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={selecionado.temperatura}
                      onChange={e => update({ temperatura: parseFloat(e.target.value) })}
                      className="ag-slider"
                    />
                    <div className="ag-temp-labels">
                      <span>Preciso (0.0)</span>
                      <span className="ag-temp-val">{Number(selecionado.temperatura).toFixed(2)}</span>
                      <span>Criativo (1.0)</span>
                    </div>
                    <div className="ag-presets">
                      {[["0.1", "Muito preciso"], ["0.2", "Preciso"], ["0.5", "Equilibrado"], ["0.7", "Criativo"]].map(([v, l]) => (
                        <button key={v} className={`ag-preset ${String(selecionado.temperatura) === v || Number(selecionado.temperatura).toFixed(1) === parseFloat(v).toFixed(1) ? "preset-on" : ""}`}
                          onClick={() => update({ temperatura: parseFloat(v) })}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modelo */}
                <div className="ag-card">
                  <div className="ag-card-label">Modelo de IA</div>
                  <div className="ag-models">
                    {MODELS.map(m => (
                      <button key={m.id} className={`ag-model ${selecionado.modelo === m.id ? "model-on" : ""}`} onClick={() => update({ modelo: m.id })}>
                        <div className="ag-model-nome">{m.name}</div>
                        <div className="ag-model-desc">{m.desc}</div>
                        <div className="ag-model-cost">{m.cost}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Áudios */}
                <div className="ag-card">
                  <div className="ag-card-label">Áudios do agente</div>
                  <p className="ag-card-desc">
                    Faça upload de áudios pré-gravados. Use <code>{"[[AUDIO:nome]]"}</code> no prompt para o agente enviar o áudio no momento certo.
                  </p>

                  {/* Upload */}
                  <div className="ag-audio-upload">
                    <input
                      className="ag-audio-nome-input"
                      value={audioNome}
                      onChange={e => setAudioNome(e.target.value)}
                      placeholder="Nome do áudio (ex: boas-vindas)"
                    />
                    <button
                      className="ag-audio-upload-btn"
                      onClick={() => { if (!audioNome.trim()) { setAudioError("Digite um nome antes de selecionar o arquivo."); return; } audioInputRef.current?.click(); }}
                      disabled={uploadingAudio}
                    >
                      {uploadingAudio ? "Enviando…" : "+ Upload"}
                    </button>
                    <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={uploadAudio} />
                  </div>
                  {audioError && <div className="ag-audio-error">{audioError}</div>}

                  {/* Lista */}
                  {loadingAudios ? (
                    <div className="ag-audio-loading">Carregando áudios…</div>
                  ) : audios.length === 0 ? (
                    <div className="ag-audio-vazio">Nenhum áudio cadastrado ainda.</div>
                  ) : (
                    <div className="ag-audio-list">
                      {audios.map(audio => (
                        <div key={audio.id} className="ag-audio-item">
                          <div className="ag-audio-icon">♪</div>
                          <div className="ag-audio-info">
                            <div className="ag-audio-item-nome">{audio.nome}</div>
                            <div className="ag-audio-item-meta">
                              <code className="ag-audio-marker">{"[[AUDIO:" + audio.nome + "]]"}</code>
                              {audio.tamanho && <span className="ag-audio-size">{(audio.tamanho / 1024).toFixed(0)} KB</span>}
                            </div>
                          </div>
                          <a href={audio.url} target="_blank" rel="noreferrer" className="ag-audio-play">▶</a>
                          <button className="ag-audio-del" onClick={() => deletarAudio(audio.id)} title="Remover">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Agendamento automático */}
                <div className="ag-card">
                  <div className="ag-card-label">Agendamento automático</div>
                  <p className="ag-card-desc">
                    Controla como o agente apresenta os horários disponíveis ao lead.
                  </p>
                  <div className="ag-config-grid">
                    <div className="ag-config-field">
                      <label className="ag-config-label">Dias exibidos</label>
                      <p className="ag-config-hint">Quantos dias diferentes mostrar ao lead (1–14)</p>
                      <input
                        type="number" min={1} max={14}
                        className="ag-config-input"
                        value={selecionado.config?.escassez_max_dias ?? 2}
                        onChange={e => updateConfig({ escassez_max_dias: Math.max(1, Math.min(14, parseInt(e.target.value) || 2)) })}
                      />
                    </div>
                    <div className="ag-config-field">
                      <label className="ag-config-label">Horários por dia</label>
                      <p className="ag-config-hint">Quantas opções de horário exibir por dia (1–8)</p>
                      <input
                        type="number" min={1} max={8}
                        className="ag-config-input"
                        value={selecionado.config?.escassez_max_slots ?? 3}
                        onChange={e => updateConfig({ escassez_max_slots: Math.max(1, Math.min(8, parseInt(e.target.value) || 3)) })}
                      />
                    </div>
                    <div className="ag-config-field">
                      <label className="ag-config-label">Pausa entre mensagens (seg)</label>
                      <p className="ag-config-hint">Intervalo entre partes de uma sequência ---PAUSA---</p>
                      <input
                        type="number" min={5} max={300}
                        className="ag-config-input"
                        value={selecionado.config?.pausa_sequencia_seg ?? 30}
                        onChange={e => updateConfig({ pausa_sequencia_seg: Math.max(5, Math.min(300, parseInt(e.target.value) || 30)) })}
                      />
                    </div>
                  </div>
                </div>

                {/* Prompt */}
                <div className="ag-card">
                  <div className="ag-prompt-header">
                    <div>
                      <div className="ag-card-label">Prompt do sistema</div>
                      <p className="ag-card-desc">Define a personalidade e comportamento deste agente.</p>
                    </div>
                    <button className="ag-reset-btn" onClick={() => update({ prompt: DEFAULT_PROMPT })}>↺ Padrão</button>
                  </div>
                  <textarea
                    className="ag-prompt"
                    value={selecionado.prompt}
                    onChange={e => update({ prompt: e.target.value })}
                    rows={18}
                    spellCheck={false}
                  />
                  <div className="ag-chars">{selecionado.prompt.length} caracteres</div>
                </div>

                {/* Ações desktop */}
                <div className="ag-footer">
                  {agentes.length > 1 && (
                    <button className="ag-excluir-btn-desktop" onClick={() => setConfirmarExclusao(true)} disabled={excluindo}>
                      Excluir agente
                    </button>
                  )}
                  <button className="ag-salvar-btn-desktop" onClick={salvar} disabled={saving}>
                    {saving ? "Salvando…" : saved ? "✓ Salvo" : "Salvar configurações"}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

const css = `
  .agente-loading{padding:40px;color:#7a6e5e;font-size:14px;}
  .ag-root{display:flex;height:calc(100vh - 60px);overflow:hidden;background:#0e0f09;}

  /* Sidebar */
  .ag-sidebar{width:280px;flex-shrink:0;background:#111009;border-right:1px solid #2a1f18;display:flex;flex-direction:column;overflow:hidden;}
  .ag-sidebar-header{padding:28px 24px 20px;border-bottom:1px solid #2a1f18;}
  .ag-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#fff9e6;margin-bottom:4px;}
  .ag-sub{font-size:12px;color:#4a3e30;}
  .ag-list{flex:1;overflow-y:auto;padding:12px;}
  .ag-item{width:100%;background:none;border:1px solid transparent;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;font-family:inherit;transition:all .15s;text-align:left;}
  .ag-item:hover{background:rgba(255,255,255,.03);border-color:#2a1f18;}
  .ag-item-ativo{background:rgba(194,144,77,.08)!important;border-color:rgba(194,144,77,.3)!important;}
  .ag-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .dot-on{background:#6acca0;box-shadow:0 0 5px rgba(106,204,160,.4);}
  .dot-off{background:#4a3e30;}
  .ag-item-info{display:flex;flex-direction:column;gap:2px;}
  .ag-item-nome{font-size:14px;font-weight:600;color:#fff9e6;}
  .ag-item-ativo .ag-item-nome{color:#c2904d;}
  .ag-item-canais{font-size:11px;color:#4a3e30;}
  .ag-novo-btn{margin:12px;background:rgba(194,144,77,.1);border:1px dashed rgba(194,144,77,.3);border-radius:10px;padding:12px;color:#c2904d;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;}
  .ag-novo-btn:hover:not(:disabled){background:rgba(194,144,77,.15);}
  .ag-novo-btn:disabled{opacity:.5;cursor:not-allowed;}

  /* Editor */
  .ag-editor{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
  .ag-empty{flex:1;display:flex;align-items:center;justify-content:center;color:#4a3e30;font-size:14px;}
  .ag-editor-header{display:none;}
  .ag-error{background:rgba(224,88,64,.1);border:1px solid rgba(224,88,64,.3);border-radius:10px;padding:12px 16px;font-size:14px;color:#e05840;margin:20px 24px 0;}
  .ag-confirm{background:#1a1410;border:1px solid rgba(224,88,64,.3);border-radius:12px;padding:20px 24px;margin:20px 24px 0;}
  .ag-confirm p{font-size:14px;color:#fff9e6;margin-bottom:14px;}
  .ag-confirm strong{color:#e07070;}
  .ag-confirm-btns{display:flex;gap:10px;}
  .ag-confirm-btns button{border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid #2a1f18;background:rgba(255,255,255,.03);color:#7a6e5e;transition:all .15s;}
  .ag-confirm-btns button:hover{border-color:#4a3e30;color:#fff9e6;}
  .btn-danger{background:rgba(224,88,64,.15)!important;border-color:rgba(224,88,64,.4)!important;color:#e05840!important;}
  .btn-danger:hover{background:rgba(224,88,64,.25)!important;}

  /* Form */
  .ag-form{padding:24px;display:flex;flex-direction:column;gap:16px;}
  .ag-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:22px 24px;}
  .ag-card-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;margin-bottom:12px;}
  .ag-card-desc{font-size:13px;color:#7a6e5e;line-height:1.6;margin-bottom:14px;font-weight:300;}
  .ag-nome-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
  .ag-nome-input{flex:1;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:11px 14px;font-size:16px;font-weight:600;color:#fff9e6;font-family:'Cormorant Garamond',Georgia,serif;outline:none;transition:border-color .2s;}
  .ag-nome-input:focus{border-color:rgba(194,144,77,.4);}
  .ag-toggle{width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;position:relative;flex-shrink:0;transition:background .2s;}
  .tog-on{background:#c2904d;}
  .tog-off{background:#2a1f18;}
  .tog-knob{position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff9e6;transition:left .2s;}
  .tog-on .tog-knob{left:23px;}
  .tog-off .tog-knob{left:3px;}
  .ag-toggle-label{font-size:12px;color:#7a6e5e;white-space:nowrap;}
  .ag-desc-input{width:100%;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:10px 14px;font-size:13px;color:#7a6e5e;font-family:inherit;outline:none;transition:border-color .2s;}
  .ag-desc-input:focus{border-color:rgba(194,144,77,.3);}
  .ag-canal-vazio{font-size:13px;color:#4a3e30;}
  .ag-canais{display:flex;flex-wrap:wrap;gap:10px;}
  .ag-canal{background:rgba(255,255,255,.02);border:1px solid #2a1f18;border-radius:12px;padding:12px 14px;cursor:pointer;font-family:inherit;transition:all .15s;text-align:left;min-width:160px;}
  .ag-canal:hover:not(.canal-off){border-color:rgba(194,144,77,.3);}
  .canal-on{border-color:#c2904d!important;background:rgba(194,144,77,.08)!important;}
  .canal-off{opacity:.45;cursor:not-allowed;}
  .ag-canal-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;}
  .ag-canal-dot{width:7px;height:7px;border-radius:50%;}
  .dot-green{background:#6acca0;}
  .dot-gray{background:#4a3e30;}
  .ag-canal-provider{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4a3e30;flex:1;}
  .canal-on .ag-canal-provider{color:rgba(194,144,77,.7);}
  .ag-canal-check{font-size:11px;color:#c2904d;font-weight:700;}
  .ag-canal-nome{font-size:13px;font-weight:600;color:#fff9e6;margin-bottom:2px;}
  .ag-canal-phone{font-size:11px;color:#7a6e5e;font-family:monospace;}
  .ag-canal-offline{font-size:11px;color:#e07070;margin-top:3px;}
  .ag-link-input{width:100%;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:11px 14px;font-size:13px;color:#fff9e6;font-family:monospace;outline:none;transition:border-color .2s;}
  .ag-link-input:focus{border-color:rgba(194,144,77,.4);}
  .ag-link-input::placeholder{color:#4a3e30;}
  .ag-card code{font-size:12px;background:rgba(194,144,77,.1);color:#c2904d;padding:1px 6px;border-radius:4px;font-family:monospace;}
  .ag-temp-row{display:flex;flex-direction:column;gap:10px;}
  .ag-slider{width:100%;accent-color:#c2904d;cursor:pointer;}
  .ag-temp-labels{display:flex;justify-content:space-between;font-size:12px;color:#7a6e5e;}
  .ag-temp-val{font-size:14px;font-weight:700;color:#c2904d;}
  .ag-presets{display:flex;gap:8px;flex-wrap:wrap;}
  .ag-preset{background:rgba(255,255,255,.03);border:1px solid #2a1f18;border-radius:8px;padding:6px 13px;font-size:12px;color:#7a6e5e;cursor:pointer;font-family:inherit;transition:all .15s;}
  .ag-preset:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .preset-on{background:rgba(194,144,77,.1)!important;border-color:rgba(194,144,77,.3)!important;color:#c2904d!important;font-weight:600;}
  .ag-models{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;}
  .ag-model{background:rgba(255,255,255,.02);border:1px solid #2a1f18;border-radius:12px;padding:14px 16px;text-align:left;cursor:pointer;font-family:inherit;transition:all .15s;}
  .ag-model:hover{border-color:rgba(194,144,77,.3);}
  .model-on{border-color:#c2904d!important;background:rgba(194,144,77,.08)!important;}
  .ag-model-nome{font-size:13px;font-weight:700;color:#fff9e6;margin-bottom:4px;}
  .model-on .ag-model-nome{color:#c2904d;}
  .ag-model-desc{font-size:12px;color:#7a6e5e;line-height:1.5;margin-bottom:6px;font-weight:300;}
  .ag-model-cost{font-size:10px;font-weight:700;letter-spacing:.5px;color:#4a3e30;text-transform:uppercase;}
  .model-on .ag-model-cost{color:rgba(194,144,77,.5);}
  .ag-prompt-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px;}
  .ag-reset-btn{background:none;border:1px solid #2a1f18;border-radius:8px;padding:6px 12px;font-size:12px;color:#7a6e5e;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .ag-reset-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .ag-prompt{width:100%;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:14px;font-size:13px;color:#fff9e6;font-family:monospace;line-height:1.7;resize:vertical;outline:none;transition:border-color .2s;}
  .ag-prompt:focus{border-color:rgba(194,144,77,.3);}
  .ag-chars{font-size:11px;color:#4a3e30;text-align:right;margin-top:6px;}
  .ag-footer{display:flex;justify-content:flex-end;align-items:center;gap:12px;padding-bottom:8px;}
  .ag-salvar-btn-desktop{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:12px;padding:13px 28px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;}
  .ag-salvar-btn-desktop:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px);}
  .ag-salvar-btn-desktop:disabled{opacity:.6;cursor:not-allowed;}
  .ag-excluir-btn-desktop{background:none;border:1px solid rgba(224,88,64,.3);border-radius:12px;padding:12px 20px;font-size:13px;font-weight:600;color:#e07070;cursor:pointer;font-family:inherit;transition:all .15s;}
  .ag-excluir-btn-desktop:hover:not(:disabled){background:rgba(224,88,64,.08);}
  .ag-excluir-btn-desktop:disabled{opacity:.3;cursor:not-allowed;}

  /* Mobile */
  /* Áudios */
  .ag-audio-upload{display:flex;gap:10px;margin-bottom:10px;}
  .ag-audio-nome-input{flex:1;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:10px 14px;font-size:13px;color:#fff9e6;font-family:monospace;outline:none;transition:border-color .2s;}
  .ag-audio-nome-input:focus{border-color:rgba(194,144,77,.4);}
  .ag-audio-nome-input::placeholder{color:#4a3e30;}
  .ag-audio-upload-btn{background:rgba(194,144,77,.1);border:1px solid rgba(194,144,77,.3);border-radius:10px;padding:10px 18px;font-size:13px;font-weight:600;color:#c2904d;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all .15s;}
  .ag-audio-upload-btn:hover:not(:disabled){background:rgba(194,144,77,.18);}
  .ag-audio-upload-btn:disabled{opacity:.5;cursor:not-allowed;}
  .ag-audio-error{font-size:12px;color:#e07070;margin-bottom:10px;}
  .ag-audio-loading{font-size:13px;color:#4a3e30;padding:8px 0;}
  .ag-audio-vazio{font-size:13px;color:#4a3e30;font-style:italic;}
  .ag-audio-list{display:flex;flex-direction:column;gap:8px;margin-top:4px;}
  .ag-audio-item{display:flex;align-items:center;gap:10px;background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:10px 14px;}
  .ag-audio-icon{font-size:18px;color:#c2904d;flex-shrink:0;width:22px;text-align:center;}
  .ag-audio-info{flex:1;min-width:0;}
  .ag-audio-item-nome{font-size:13px;font-weight:600;color:#fff9e6;margin-bottom:3px;}
  .ag-audio-item-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .ag-audio-marker{font-size:11px;background:rgba(194,144,77,.1);color:#c2904d;padding:2px 7px;border-radius:4px;font-family:monospace;}
  .ag-audio-size{font-size:11px;color:#4a3e30;}
  .ag-audio-play{width:28px;height:28px;border-radius:50%;background:rgba(106,204,160,.1);border:1px solid rgba(106,204,160,.25);color:#6acca0;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;flex-shrink:0;transition:all .15s;}
  .ag-audio-play:hover{background:rgba(106,204,160,.2);}

  /* Config */
  .ag-config-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;}
  .ag-config-field{display:flex;flex-direction:column;gap:6px;}
  .ag-config-label{font-size:12px;font-weight:600;color:#c2904d;}
  .ag-config-hint{font-size:11px;color:#4a3e30;line-height:1.5;margin:0;}
  .ag-config-input{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:9px 12px;font-size:14px;font-weight:600;color:#fff9e6;font-family:monospace;outline:none;width:100%;transition:border-color .2s;}
  .ag-config-input:focus{border-color:rgba(194,144,77,.4);}

  .ag-audio-del{width:28px;height:28px;border-radius:50%;background:none;border:1px solid rgba(224,88,64,.2);color:#e07070;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .15s;}
  .ag-audio-del:hover{background:rgba(224,88,64,.1);border-color:rgba(224,88,64,.4);}

  @media(max-width:768px){
    .ag-root{flex-direction:column;height:auto;min-height:calc(100vh - 60px);}
    .ag-sidebar{width:100%;border-right:none;border-bottom:1px solid #2a1f18;}
    .ag-sidebar-hidden{display:none;}
    .ag-editor{display:flex;}
    .ag-editor-hidden{display:none;}
    .ag-editor-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #2a1f18;background:#111009;}
    .ag-back-btn{background:none;border:none;color:#c2904d;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;padding:0;}
    .ag-editor-actions{display:flex;gap:8px;}
    .ag-salvar-btn{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
    .ag-salvar-btn:disabled{opacity:.6;}
    .ag-excluir-btn{background:none;border:1px solid rgba(224,88,64,.3);border-radius:8px;padding:7px 14px;font-size:13px;color:#e07070;cursor:pointer;font-family:inherit;}
    .ag-footer{display:none;}
    .ag-form{padding:16px;}
    .ag-canais{flex-direction:column;}
    .ag-canal{min-width:unset;}
  }
  @media(min-width:769px){
    .ag-salvar-btn,.ag-excluir-btn,.ag-back-btn{display:none;}
  }
`;

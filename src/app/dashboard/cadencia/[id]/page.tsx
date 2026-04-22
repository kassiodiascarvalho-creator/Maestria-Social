"use client";

import { useState, useCallback, useRef, useEffect, use } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  Handle, Position, ReactFlowProvider,
} from "@xyflow/react";
import type { Node, Edge, Connection, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";

// ─── Tipos ────────────────────────────────────────────────────────────
type FlowData = Record<string, unknown>;
type FlowNode = Node<FlowData>;
type FlowEdge = Edge;

// ─── Cores por tipo ───────────────────────────────────────────────────
const COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  inicio:    { bg: "#c2a44a20", border: "#c2a44a60", icon: "⚡" },
  mensagem:  { bg: "#3b82f620", border: "#3b82f660", icon: "💬" },
  aguardar:  { bg: "#6b728020", border: "#6b728060", icon: "⏰" },
  condicao:  { bg: "#f9731620", border: "#f9731660", icon: "◇" },
  tag:       { bg: "#22c55e20", border: "#22c55e60", icon: "🏷" },
  agente_ia: { bg: "#a855f720", border: "#a855f760", icon: "🤖" },
  webhook:   { bg: "#06b6d420", border: "#06b6d460", icon: "🔗" },
  fim:       { bg: "#ef444420", border: "#ef444460", icon: "🏁" },
};
const TIPO_LABEL: Record<string, string> = {
  inicio: "Início", mensagem: "Mensagem", aguardar: "Aguardar",
  condicao: "Condição", tag: "Tag", agente_ia: "Agente IA",
  webhook: "Webhook", fim: "Fim",
};
const fallback = { bg: "#6b728020", border: "#6b728060", icon: "◈" };

// ─── Node base ────────────────────────────────────────────────────────
function BaseNode({ tipo, data, selected, children }: {
  tipo: string; data: FlowData; selected?: boolean; children?: React.ReactNode;
}) {
  const c = COLORS[tipo] ?? fallback;
  const d = data as Record<string, unknown>;
  return (
    <div style={{
      width: 230, background: "#111", border: `1.5px solid ${selected ? "#c2a44a" : c.border}`,
      borderRadius: 12, overflow: "hidden",
      boxShadow: selected ? "0 0 0 2px #c2a44a40" : "0 4px 20px rgba(0,0,0,.5)",
    }}>
      <div style={{ background: c.bg, borderBottom: `1px solid ${c.border}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>{c.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: .3 }}>
          {(d.label as string) ?? TIPO_LABEL[tipo]}
        </span>
      </div>
      <div style={{ padding: "10px 14px", fontSize: 12, color: "#9ca3af", minHeight: 36 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Custom nodes ─────────────────────────────────────────────────────
function InicioNode({ data, selected }: NodeProps<FlowNode>) {
  const d = data as Record<string, unknown>;
  const triggers: Record<string, string> = { manual: "Disparo manual", form_submit: "Formulário enviado", tag_add: "Tag adicionada", lead_criado: "Lead criado", sdr: "Agente SDR", import: "Importação" };
  return (
    <BaseNode tipo="inicio" data={data} selected={selected}>
      <span style={{ color: "#c2a44a" }}>{triggers[String(d.trigger_tipo ?? "manual")] ?? "Manual"}</span>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </BaseNode>
  );
}

function MensagemNode({ data, selected }: NodeProps<FlowNode>) {
  const d = data as Record<string, unknown>;
  const tipo = String(d.tipo ?? "texto");
  const tipoIcons: Record<string, string> = { texto: "💬", imagem: "🖼", audio: "🎙", video: "🎬", documento: "📄" };
  const preview = tipo === "texto"
    ? ((d.texto as string)?.slice(0, 55) || "Sem texto definido")
    : (String(d.url_midia ?? "").split("/").pop()?.slice(0, 35) || "Sem mídia");
  return (
    <BaseNode tipo="mensagem" data={data} selected={selected}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11, background: "#3b82f620", border: "1px solid #3b82f640", borderRadius: 4, padding: "1px 6px", color: "#60a5fa" }}>
          {tipoIcons[tipo]} {tipo}
        </span>
      </div>
      <span style={{ color: "#d1d5db", lineHeight: 1.5 }}>{preview}{(d.texto as string)?.length > 55 ? "..." : ""}</span>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </BaseNode>
  );
}

function AguardarNode({ data, selected }: NodeProps<FlowNode>) {
  const d = data as Record<string, unknown>;
  return (
    <BaseNode tipo="aguardar" data={data} selected={selected}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <span>Aguardar <strong style={{ color: "#d1d5db" }}>{String(d.quantidade ?? 1)} {String(d.unidade ?? "horas")}</strong></span>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </BaseNode>
  );
}

function CondicaoNode({ data, selected }: NodeProps<FlowNode>) {
  const d = data as Record<string, unknown>;
  return (
    <BaseNode tipo="condicao" data={data} selected={selected}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <span style={{ color: "#d1d5db" }}>{String(d.campo ?? "campo")} <span style={{ color: "#f97316" }}>{String(d.operador ?? "existe")}</span></span>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11 }}>
        <Handle type="source" position={Position.Bottom} id="sim" style={{ ...handleStyle, left: "30%", background: "#22c55e" }} />
        <span style={{ color: "#22c55e", marginLeft: 10 }}>✓ Sim</span>
        <span style={{ color: "#ef4444", marginRight: 10 }}>✗ Não</span>
        <Handle type="source" position={Position.Bottom} id="nao" style={{ ...handleStyle, left: "70%", background: "#ef4444" }} />
      </div>
    </BaseNode>
  );
}

function TagNode({ data, selected }: NodeProps<FlowNode>) {
  const d = data as Record<string, unknown>;
  return (
    <BaseNode tipo="tag" data={data} selected={selected}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <span style={{ background: "#22c55e20", border: "1px solid #22c55e40", borderRadius: 4, padding: "2px 8px", color: "#22c55e" }}>
        {String(d.tag || "sem tag")}
      </span>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </BaseNode>
  );
}

function AgenteIANode({ data, selected }: NodeProps<FlowNode>) {
  const d = data as Record<string, unknown>;
  return (
    <BaseNode tipo="agente_ia" data={data} selected={selected}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <span style={{ color: "#a855f7" }}>SDR ativa para este lead</span>
      {!!d.instrucoes && <div style={{ marginTop: 4, color: "#9ca3af", fontStyle: "italic" }}>{String(d.instrucoes).slice(0, 50)}...</div>}
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </BaseNode>
  );
}

function WebhookNode({ data, selected }: NodeProps<FlowNode>) {
  const d = data as Record<string, unknown>;
  const url = String(d.url ?? "");
  const shortUrl = url.length > 35 ? "..." + url.slice(-32) : url || "URL não definida";
  return (
    <BaseNode tipo="webhook" data={data} selected={selected}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, background: "#06b6d420", border: "1px solid #06b6d440", borderRadius: 4, padding: "1px 6px", color: "#22d3ee" }}>
          {String(d.metodo ?? "POST")}
        </span>
      </div>
      <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 11, wordBreak: "break-all" }}>{shortUrl}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </BaseNode>
  );
}

function FimNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <BaseNode tipo="fim" data={data} selected={selected}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <span style={{ color: "#ef4444" }}>Fluxo encerrado</span>
    </BaseNode>
  );
}

const handleStyle: React.CSSProperties = { width: 10, height: 10, background: "#c2a44a", border: "2px solid #0a0a0a" };

const NODE_TYPES = {
  inicio: InicioNode, mensagem: MensagemNode, aguardar: AguardarNode,
  condicao: CondicaoNode, tag: TagNode, agente_ia: AgenteIANode,
  webhook: WebhookNode, fim: FimNode,
};

// ─── Default data por tipo ────────────────────────────────────────────
const DEFAULT_DATA: Record<string, FlowData> = {
  inicio:    { label: "Início", trigger_tipo: "manual", trigger_config: {} },
  mensagem:  { label: "Mensagem", texto: "", tipo: "texto", url_midia: "", legenda: "" },
  aguardar:  { label: "Aguardar", quantidade: 1, unidade: "horas" },
  condicao:  { label: "Condição", campo: "whatsapp", operador: "existe", valor: "" },
  tag:       { label: "Atribuir Tag", tag: "" },
  agente_ia: { label: "Agente IA", instrucoes: "" },
  webhook:   { label: "Webhook", url: "", metodo: "POST", descricao: "" },
  fim:       { label: "Fim" },
};

// ─── Palette items ────────────────────────────────────────────────────
const PALETTE_ITEMS = [
  { tipo: "mensagem",  label: "Mensagem" },
  { tipo: "aguardar",  label: "Aguardar" },
  { tipo: "condicao",  label: "Condição" },
  { tipo: "tag",       label: "Tag" },
  { tipo: "agente_ia", label: "Agente IA" },
  { tipo: "webhook",   label: "Webhook" },
  { tipo: "fim",       label: "Fim" },
];

// ─── AI Templates ─────────────────────────────────────────────────────
const AI_TEMPLATES = [
  {
    emoji: "🚀",
    titulo: "Lançamento de Curso",
    descricao: "Sequência de 7 dias para lançamento de infoproduto. Dia 1: boas-vindas e expectativa. Dia 2: conteúdo de valor gratuito. Dia 3: prova social e depoimentos. Dia 4: aprofundamento do problema. Dia 5: apresentação da solução. Dia 6: urgência e bônus. Dia 7: última chamada com escassez.",
    trigger: "form_submit",
  },
  {
    emoji: "🎯",
    titulo: "Qualificação SDR",
    descricao: "Fluxo de qualificação de leads B2B. Mensagem inicial de apresentação, aguarda 1h, verifica se tem WhatsApp, ativa agente SDR para qualificação, adiciona tag de lead qualificado ou não-qualificado, envia para pipeline correto.",
    trigger: "lead_criado",
  },
  {
    emoji: "📋",
    titulo: "Onboarding Pós-Compra",
    descricao: "Sequência de onboarding para novos alunos. Boas-vindas imediatas, acesso à plataforma após 30min, primeiro passo do curso após 2h, acompanhamento no dia 3, engajamento no dia 7, coleta de feedback no dia 14.",
    trigger: "tag_add",
  },
  {
    emoji: "🔥",
    titulo: "Reengajamento de Leads Frios",
    descricao: "Reativação de leads que não interagiram há mais de 30 dias. Mensagem surpresa com conteúdo de valor, aguarda 1 dia, verifica engajamento pela tag, envia oferta especial para os engajados, remove tag dos não-engajados.",
    trigger: "manual",
  },
  {
    emoji: "🎓",
    titulo: "Pré-lançamento (Lista VIP)",
    descricao: "Aquecimento de lista VIP antes do lançamento. Conteúdo exclusivo a cada 2 dias durante 10 dias. Stories de bastidores, webinar gratuito no dia 5, revelação do produto no dia 8, abertura de carrinho no dia 10 com bônus exclusivos para a lista.",
    trigger: "form_submit",
  },
  {
    emoji: "💼",
    titulo: "Follow-up Comercial",
    descricao: "Sequência de follow-up para leads que solicitaram proposta. Confirmação imediata, apresentação de casos de sucesso após 4h, perguntas de objeção após 1 dia, depoimentos vídeo após 2 dias, proposta final com desconto no dia 5, encerra fluxo após 7 dias sem resposta.",
    trigger: "manual",
  },
];

// ─── Node config panel ────────────────────────────────────────────────
function NodePanel({ node, onChange, onDelete }: {
  node: FlowNode;
  onChange: (id: string, data: FlowData) => void;
  onDelete: (id: string) => void;
}) {
  const d = node.data as Record<string, unknown>;
  const upd = (key: string, val: unknown) => onChange(node.id, { ...d, [key]: val });
  const tipo = node.type ?? "";
  const c = COLORS[tipo] ?? fallback;
  const tipoMsg = String(d.tipo ?? "texto");

  return (
    <div style={{
      width: 300, background: "#0f0f0f", borderLeft: "1px solid #1a1a1a",
      padding: "20px 18px", overflow: "auto", display: "flex", flexDirection: "column", gap: 16,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#c2a44a", letterSpacing: 1.2, textTransform: "uppercase" }}>
          {c.icon} {TIPO_LABEL[tipo] ?? tipo}
        </div>
        <button onClick={() => onDelete(node.id)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#6b7280", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>
          Excluir
        </button>
      </div>

      <div>
        <label style={lbl}>Rótulo do nó</label>
        <input value={String(d.label ?? "")} onChange={e => upd("label", e.target.value)} style={inp} />
      </div>

      {tipo === "inicio" && (
        <div>
          <label style={lbl}>Gatilho</label>
          <select value={String(d.trigger_tipo ?? "manual")} onChange={e => upd("trigger_tipo", e.target.value)} style={inp}>
            <option value="manual">Disparo manual</option>
            <option value="form_submit">Formulário enviado</option>
            <option value="tag_add">Tag adicionada</option>
            <option value="lead_criado">Lead criado</option>
            <option value="sdr">Agente SDR</option>
            <option value="import">Importação de leads</option>
          </select>
        </div>
      )}

      {tipo === "mensagem" && (
        <>
          <div>
            <label style={lbl}>Tipo de conteúdo</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { v: "texto",    label: "💬 Texto" },
                { v: "imagem",   label: "🖼 Imagem" },
                { v: "audio",    label: "🎙 Áudio" },
                { v: "video",    label: "🎬 Vídeo" },
                { v: "documento", label: "📄 Doc" },
              ].map(opt => (
                <button key={opt.v} onClick={() => upd("tipo", opt.v)} style={{
                  background: tipoMsg === opt.v ? "#3b82f620" : "transparent",
                  border: `1px solid ${tipoMsg === opt.v ? "#3b82f660" : "#2a2a2a"}`,
                  color: tipoMsg === opt.v ? "#60a5fa" : "#6b7280",
                  borderRadius: 7, padding: "7px 6px", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {tipoMsg === "texto" ? (
            <div>
              <label style={lbl}>Mensagem WhatsApp</label>
              <textarea
                value={String(d.texto ?? "")}
                onChange={e => upd("texto", e.target.value)}
                placeholder="Olá {nome}! 👋"
                style={{ ...inp, minHeight: 120, resize: "vertical" }}
              />
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>
                Variáveis: {"{nome}"} {"{email}"} {"{whatsapp}"} {"{origem}"} {"{utm_source}"}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label style={lbl}>URL da mídia</label>
                <input
                  value={String(d.url_midia ?? "")}
                  onChange={e => upd("url_midia", e.target.value)}
                  style={inp}
                  placeholder="https://exemplo.com/arquivo.mp4"
                />
              </div>
              <div>
                <label style={lbl}>Legenda / Texto</label>
                <textarea
                  value={String(d.legenda ?? "")}
                  onChange={e => upd("legenda", e.target.value)}
                  placeholder="Legenda opcional com {nome}..."
                  style={{ ...inp, minHeight: 80, resize: "vertical" }}
                />
              </div>
            </>
          )}
        </>
      )}

      {tipo === "aguardar" && (
        <>
          <div>
            <label style={lbl}>Presets rápidos</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                { q: 1,  u: "horas",  label: "1h" },
                { q: 4,  u: "horas",  label: "4h" },
                { q: 12, u: "horas",  label: "12h" },
                { q: 1,  u: "dias",   label: "1d" },
                { q: 3,  u: "dias",   label: "3d" },
                { q: 7,  u: "dias",   label: "7d" },
              ].map(p => {
                const active = Number(d.quantidade) === p.q && String(d.unidade) === p.u;
                return (
                  <button key={p.label} onClick={() => { upd("quantidade", p.q); onChange(node.id, { ...d, quantidade: p.q, unidade: p.u }); }}
                    style={{
                      background: active ? "#6b728020" : "transparent",
                      border: `1px solid ${active ? "#6b728080" : "#2a2a2a"}`,
                      color: active ? "#d1d5db" : "#6b7280",
                      borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                    }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Quantidade</label>
              <input type="number" min={1} value={Number(d.quantidade ?? 1)} onChange={e => upd("quantidade", Number(e.target.value))} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Unidade</label>
              <select value={String(d.unidade ?? "horas")} onChange={e => upd("unidade", e.target.value)} style={inp}>
                <option value="minutos">Minutos</option>
                <option value="horas">Horas</option>
                <option value="dias">Dias</option>
              </select>
            </div>
          </div>
        </>
      )}

      {tipo === "condicao" && (
        <>
          <div>
            <label style={lbl}>Campo do lead</label>
            <select value={String(d.campo ?? "whatsapp")} onChange={e => upd("campo", e.target.value)} style={inp}>
              <option value="nome">Nome</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="origem">Origem</option>
              <option value="utm_source">UTM Source</option>
              <option value="tags">Tags</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Operador</label>
            <select value={String(d.operador ?? "existe")} onChange={e => upd("operador", e.target.value)} style={inp}>
              <option value="existe">Existe / Preenchido</option>
              <option value="nao_existe">Não existe / Vazio</option>
              <option value="igual">Igual a</option>
              <option value="contem">Contém</option>
              <option value="nao_contem">Não contém</option>
            </select>
          </div>
          {(d.operador === "igual" || d.operador === "contem" || d.operador === "nao_contem") && (
            <div>
              <label style={lbl}>Valor</label>
              <input value={String(d.valor ?? "")} onChange={e => upd("valor", e.target.value)} style={inp} placeholder="Digite o valor..." />
            </div>
          )}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#6b7280" }}>
            <div style={{ color: "#22c55e", marginBottom: 4 }}>✓ Sim → caminho verde</div>
            <div style={{ color: "#ef4444" }}>✗ Não → caminho vermelho</div>
          </div>
        </>
      )}

      {tipo === "tag" && (
        <div>
          <label style={lbl}>Nome da tag</label>
          <input value={String(d.tag ?? "")} onChange={e => upd("tag", e.target.value)} style={inp} placeholder="ex: interessado, comprou..." />
        </div>
      )}

      {tipo === "agente_ia" && (
        <div>
          <label style={lbl}>Instruções para o agente</label>
          <textarea
            value={String(d.instrucoes ?? "")}
            onChange={e => upd("instrucoes", e.target.value)}
            style={{ ...inp, minHeight: 100, resize: "vertical" }}
            placeholder="Qualifique o lead e agende uma demonstração..."
          />
        </div>
      )}

      {tipo === "webhook" && (
        <>
          <div>
            <label style={lbl}>URL do webhook</label>
            <input value={String(d.url ?? "")} onChange={e => upd("url", e.target.value)} style={inp} placeholder="https://hooks.zapier.com/..." />
          </div>
          <div>
            <label style={lbl}>Método HTTP</label>
            <select value={String(d.metodo ?? "POST")} onChange={e => upd("metodo", e.target.value)} style={inp}>
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Descrição (opcional)</label>
            <input value={String(d.descricao ?? "")} onChange={e => upd("descricao", e.target.value)} style={inp} placeholder="ex: Notificar CRM externo" />
          </div>
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#6b7280" }}>
            Enviará dados do lead + flow_id + execucao_id como JSON. Timeout: 10s.
          </div>
        </>
      )}
    </div>
  );
}

// ─── AI Modal ─────────────────────────────────────────────────────────
function AIModal({ onClose, onGenerate }: {
  onClose: () => void;
  onGenerate: (desc: string, trigger: string) => Promise<void>;
}) {
  const [desc, setDesc] = useState("");
  const [trigger, setTrigger] = useState("form_submit");
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 620, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>🤖 Gerar Fluxo com IA</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Descreva o objetivo da cadência e a IA cria o fluxo completo.</div>

        {/* Templates */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Usar como ponto de partida</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {AI_TEMPLATES.map(tpl => (
              <button key={tpl.titulo} onClick={() => { setDesc(tpl.descricao); setTrigger(tpl.trigger); }}
                style={{
                  background: desc === tpl.descricao ? "#a855f720" : "#0d0d0d",
                  border: `1px solid ${desc === tpl.descricao ? "#a855f750" : "#2a2a2a"}`,
                  borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left",
                  display: "flex", flexDirection: "column", gap: 4, transition: "border-color .15s",
                }}>
                <span style={{ fontSize: 18 }}>{tpl.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#d1d5db" }}>{tpl.titulo}</span>
              </button>
            ))}
          </div>
        </div>

        <label style={lbl}>Descreva o fluxo</label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          style={{ ...inp, minHeight: 110, marginBottom: 14, resize: "vertical" }}
          placeholder="Ex: Sequência de 7 dias para lançamento de curso online..."
        />
        <label style={{ ...lbl, marginTop: 4 }}>Gatilho principal</label>
        <select value={trigger} onChange={e => setTrigger(e.target.value)} style={{ ...inp, marginBottom: 20 }}>
          <option value="form_submit">Formulário enviado</option>
          <option value="manual">Disparo manual</option>
          <option value="lead_criado">Lead criado</option>
          <option value="tag_add">Tag adicionada</option>
          <option value="sdr">Agente SDR</option>
          <option value="import">Importação</option>
        </select>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", color: "#9ca3af", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontFamily: "inherit" }}>
            Cancelar
          </button>
          <button
            disabled={!desc.trim() || loading}
            onClick={async () => { setLoading(true); await onGenerate(desc, trigger); setLoading(false); onClose(); }}
            style={{ flex: 2, background: loading ? "#1a1a1a" : "#c2a44a", color: loading ? "#a855f7" : "#0d0d0d", border: loading ? "1px solid #a855f740" : "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: (!desc.trim() || loading) ? 0.9 : 1, fontFamily: "inherit", transition: "all .3s" }}
          >
            {loading ? "🤖 Montando fluxo com IA..." : "✨ Gerar com IA"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inner canvas ─────────────────────────────────────────────────────
function FlowCanvas({
  flowId, nome, setNome, flowStatus, setFlowStatus, triggerTipo, setTriggerTipo,
}: {
  flowId: string; nome: string; setNome: (v: string) => void;
  flowStatus: string; setFlowStatus: (v: string) => void;
  triggerTipo: string; setTriggerTipo: (v: string) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dragRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/cadencia/flows/${flowId}`)
      .then(r => r.json())
      .then(d => {
        setNome(d.nome ?? "");
        setFlowStatus(d.status ?? "rascunho");
        setTriggerTipo(d.trigger_tipo ?? "manual");
        const rfNodes: FlowNode[] = (d.nodes ?? []).map((n: Record<string, unknown>) => ({
          id: String(n.id), type: String(n.tipo),
          position: { x: Number(n.pos_x) || 0, y: Number(n.pos_y) || 0 },
          data: { ...(n.config as FlowData), label: n.label },
        }));
        const rfEdges: FlowEdge[] = (d.edges ?? []).map((e: Record<string, unknown>) => ({
          id: String(e.id), source: String(e.source_id), target: String(e.target_id),
          sourceHandle: (e.source_handle as string) ?? undefined,
          animated: true, style: { stroke: "#c2a44a60", strokeWidth: 2 },
        }));
        setNodes(rfNodes);
        setEdges(rfEdges);
        setLoaded(true);
      });
  }, [flowId]);

  // Keyboard Delete → remove selected node
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNode) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        setNodes(ns => ns.filter(n => n.id !== selectedNode.id));
        setEdges(es => es.filter(ed => ed.source !== selectedNode.id && ed.target !== selectedNode.id));
        setSelectedNode(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedNode, setNodes, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges(es => addEdge({ ...connection, animated: true, style: { stroke: "#c2a44a60", strokeWidth: 2 } }, es));
  }, [setEdges]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const tipo = dragRef.current;
    if (!tipo) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = `${tipo}_${Date.now()}`;
    const newNode: FlowNode = { id, type: tipo, position, data: { ...DEFAULT_DATA[tipo] } };
    setNodes(ns => [...ns, newNode]);
    dragRef.current = null;
  }, [screenToFlowPosition, setNodes]);

  const updateNodeData = (nodeId: string, data: FlowData) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data } : n));
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data } : prev);
  };

  const deleteNode = (nodeId: string) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  const salvar = async () => {
    setSalvando(true);
    await fetch(`/api/admin/cadencia/flows/${flowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, status: flowStatus, trigger_tipo: triggerTipo, nodes, edges }),
    });
    setSalvando(false);
  };

  const gerarIA = async (desc: string, trigger: string) => {
    const r = await fetch("/api/admin/cadencia/gerar-ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao: desc, trigger_tipo: trigger }),
    });
    if (!r.ok) return;
    const d = await r.json();
    if (!d.nodes) return;
    const rfNodes: FlowNode[] = d.nodes.map((n: Record<string, unknown>) => ({
      id: String(n.id), type: String(n.type),
      position: (n.position as { x: number; y: number }) ?? { x: 300, y: 100 },
      data: { ...(n.data as FlowData) },
    }));
    const rfEdges: FlowEdge[] = (d.edges ?? []).map((e: Record<string, unknown>) => ({
      id: String(e.id), source: String(e.source), target: String(e.target),
      sourceHandle: (e.sourceHandle as string) ?? undefined,
      animated: true, style: { stroke: "#c2a44a60", strokeWidth: 2 },
    }));
    setNodes(rfNodes);
    setEdges(rfEdges);
    const ini = rfNodes.find(n => n.type === "inicio");
    if (ini) setTriggerTipo(String((ini.data as Record<string, unknown>).trigger_tipo ?? trigger));
  };

  if (!loaded) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 14 }}>
      Carregando fluxo...
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", background: "#0f0f0f", borderBottom: "1px solid #1a1a1a", flexShrink: 0, flexWrap: "wrap" }}>
        <Link href="/dashboard/cadencia" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Fluxos</Link>
        <input value={nome} onChange={e => setNome(e.target.value)} style={{ background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "inherit", minWidth: 180 }} />
        <select value={flowStatus} onChange={e => setFlowStatus(e.target.value)} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontFamily: "inherit" }}>
          <option value="rascunho">Rascunho</option>
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
        </select>
        <span style={{ fontSize: 12, color: "#4b5563", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 6, padding: "4px 9px" }}>
          {nodes.length} nós · {edges.length} conexões
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setAiModal(true)} style={{ background: "#a855f720", border: "1px solid #a855f740", color: "#a855f7", borderRadius: 8, padding: "7px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ✨ Gerar com IA
        </button>
        <button onClick={salvar} disabled={salvando} style={{ background: "#c2a44a", color: "#0d0d0d", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: salvando ? 0.6 : 1, fontFamily: "inherit" }}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Canvas + panels */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left palette */}
        <div style={{ width: 156, background: "#0a0a0a", borderRight: "1px solid #1a1a1a", padding: "16px 8px", display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, padding: "0 4px" }}>Nós</div>
          {PALETTE_ITEMS.map(item => {
            const c = COLORS[item.tipo] ?? fallback;
            return (
              <div key={item.tipo} draggable onDragStart={() => { dragRef.current = item.tipo; }}
                style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "8px 10px", cursor: "grab", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d1d5db", userSelect: "none" }}
              >
                <span>{c.icon}</span><span>{item.label}</span>
              </div>
            );
          })}
          <div style={{ marginTop: "auto", padding: "10px 4px", borderTop: "1px solid #1a1a1a", fontSize: 10, color: "#4b5563", lineHeight: 1.6 }}>
            Arraste para a tela<br />
            <span style={{ color: "#374151" }}>Del = excluir selecionado</span>
          </div>
        </div>

        {/* React Flow canvas */}
        <div style={{ flex: 1 }} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={NODE_TYPES}
            onNodeClick={(_, node) => setSelectedNode(node as FlowNode)}
            onPaneClick={() => setSelectedNode(null)}
            fitView style={{ background: "#0a0a0a" }}
            defaultEdgeOptions={{ animated: true, style: { stroke: "#c2a44a60", strokeWidth: 2 } }}
          >
            <Background color="#1a1a1a" gap={20} />
            <Controls style={{ background: "#111", border: "1px solid #2a2a2a" }} />
            <MiniMap style={{ background: "#111", border: "1px solid #2a2a2a" }} nodeColor={() => "#c2a44a40"} />
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div style={{ marginTop: 80, textAlign: "center", color: "#4b5563", pointerEvents: "none" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
                  <div style={{ fontSize: 15, color: "#6b7280", marginBottom: 6 }}>Tela vazia</div>
                  <div style={{ fontSize: 13 }}>Arraste nós da paleta ou use <span style={{ color: "#a855f7" }}>✨ Gerar com IA</span></div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Right config panel */}
        {selectedNode && <NodePanel node={selectedNode} onChange={updateNodeData} onDelete={deleteNode} />}
      </div>

      {aiModal && <AIModal onClose={() => setAiModal(false)} onGenerate={gerarIA} />}
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────
export default function CadenciaBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [nome, setNome] = useState("");
  const [flowStatus, setFlowStatus] = useState("rascunho");
  const [triggerTipo, setTriggerTipo] = useState("manual");
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0a" }}>
      <ReactFlowProvider>
        <FlowCanvas
          flowId={id} nome={nome} setNome={setNome}
          flowStatus={flowStatus} setFlowStatus={setFlowStatus}
          triggerTipo={triggerTipo} setTriggerTipo={setTriggerTipo}
        />
      </ReactFlowProvider>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 5, letterSpacing: .3 };
const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 7, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" };

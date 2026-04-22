"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Flow {
  id: string; nome: string; descricao?: string;
  trigger_tipo: string; status: string;
  total_execucoes: number; criado_em: string;
}

const TRIGGER_LABEL: Record<string, string> = {
  manual: "Manual", form_submit: "Formulário", tag_add: "Tag adicionada",
  lead_criado: "Lead criado", sdr: "Agente SDR", import: "Importação",
};
const STATUS_COLOR: Record<string, string> = {
  ativo: "#4ade80", rascunho: "#6b7280", pausado: "#facc15",
};

export default function CadenciaPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    fetch("/api/admin/cadencia/flows")
      .then(r => r.json())
      .then(d => { setFlows(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  const criarFlow = async () => {
    setCriando(true);
    const r = await fetch("/api/admin/cadencia/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Novo Fluxo", trigger_tipo: "manual" }),
    });
    const d = await r.json();
    if (d.id) router.push(`/dashboard/cadencia/${d.id}`);
    setCriando(false);
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este fluxo permanentemente?")) return;
    await fetch(`/api/admin/cadencia/flows/${id}`, { method: "DELETE" });
    setFlows(f => f.filter(x => x.id !== id));
  };

  return (
    <div style={{ padding: "32px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Fluxos de Cadência</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            Automações visuais de WhatsApp — crie sequências inteligentes ativadas por formulários, tags ou manualmente.
          </p>
        </div>
        <button onClick={criarFlow} disabled={criando} style={{
          background: "#c2a44a", color: "#0d0d0d", border: "none",
          borderRadius: 9, padding: "11px 22px", fontWeight: 700,
          fontSize: 14, cursor: "pointer", opacity: criando ? 0.6 : 1,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {criando ? "Criando..." : "+ Novo Fluxo"}
        </button>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Total de Fluxos", val: flows.length },
          { label: "Ativos", val: flows.filter(f => f.status === "ativo").length, color: "#4ade80" },
          { label: "Total Execuções", val: flows.reduce((a, f) => a + (f.total_execucoes || 0), 0), color: "#c2a44a" },
        ].map(s => (
          <div key={s.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color ?? "#fff" }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#6b7280" }}>Carregando...</div>
      ) : flows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <div style={{ color: "#6b7280", fontSize: 16, marginBottom: 8 }}>Nenhum fluxo criado ainda</div>
          <div style={{ color: "#4b5563", fontSize: 13, marginBottom: 24 }}>Crie seu primeiro fluxo e automatize o contato com seus leads</div>
          <button onClick={criarFlow} style={{ background: "#c2a44a", color: "#0d0d0d", border: "none", borderRadius: 8, padding: "12px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            Criar primeiro fluxo
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
          {flows.map(f => (
            <div key={f.id} style={{
              background: "#111", border: "1px solid #1e1e1e", borderRadius: 14,
              padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14,
              transition: "border-color .15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#2a2a2a")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e1e1e")}
            >
              {/* Card header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[f.status] ?? "#6b7280", flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{f.nome}</span>
                  </div>
                  {f.descricao && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{f.descricao}</div>}
                </div>
              </div>

              {/* Meta */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 5, padding: "3px 8px", color: "#9ca3af" }}>
                  ⚡ {TRIGGER_LABEL[f.trigger_tipo] ?? f.trigger_tipo}
                </span>
                <span style={{ fontSize: 11, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 5, padding: "3px 8px", color: "#9ca3af" }}>
                  {f.total_execucoes || 0} execuções
                </span>
                <span style={{ fontSize: 11, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 5, padding: "3px 8px", color: STATUS_COLOR[f.status] ?? "#9ca3af", textTransform: "capitalize" }}>
                  {f.status}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <Link href={`/dashboard/cadencia/${f.id}`} style={{
                  flex: 1, background: "#c2a44a18", border: "1px solid #c2a44a30",
                  color: "#c2a44a", borderRadius: 8, padding: "8px 0",
                  textAlign: "center", textDecoration: "none", fontSize: 13, fontWeight: 600,
                }}>
                  Editar Builder
                </Link>
                <button onClick={() => excluir(f.id)} style={{
                  background: "transparent", border: "1px solid #2a2a2a", color: "#6b7280",
                  borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13,
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef444450"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

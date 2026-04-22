"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Form {
  id: string;
  slug: string;
  titulo: string;
  descricao?: string;
  status: "rascunho" | "ativo" | "pausado";
  modo_exibicao: string;
  total_respostas: number;
  criado_em: string;
  atualizado_em: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ativo:    { label: "Ativo",    color: "#4ade80" },
  rascunho: { label: "Rascunho", color: "#facc15" },
  pausado:  { label: "Pausado",  color: "#94a3b8" },
};

export default function FormsPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [showModal, setShowModal] = useState(false);

  const carregar = () => {
    setLoading(true);
    fetch("/api/admin/forms")
      .then(r => r.json())
      .then(d => { setForms(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const criarForm = async () => {
    if (!titulo.trim()) return;
    setCriando(true);
    const r = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo }),
    });
    const novo = await r.json();
    setCriando(false);
    setShowModal(false);
    setTitulo("");
    if (novo.id) {
      window.location.href = `/dashboard/forms/${novo.id}/editar`;
    }
  };

  const deletarForm = async (id: string) => {
    if (!confirm("Deletar este formulário?")) return;
    await fetch(`/api/admin/forms/${id}`, { method: "DELETE" });
    carregar();
  };

  const alterarStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/forms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    carregar();
  };

  const totalRespostas = forms.reduce((s, f) => s + (f.total_respostas ?? 0), 0);
  const ativos = forms.filter(f => f.status === "ativo").length;

  return (
    <div style={{ padding: "32px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Formulários</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Crie formulários inteligentes e capture leads com estilo.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: "#c2a44a", color: "#0d0d0d", border: "none",
            borderRadius: 8, padding: "10px 22px", fontWeight: 700,
            fontSize: 14, cursor: "pointer",
          }}
        >
          + Novo Formulário
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total de Formulários", val: forms.length, icon: "◫" },
          { label: "Formulários Ativos", val: ativos, icon: "◎" },
          { label: "Total de Respostas", val: totalRespostas, icon: "◉" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#111", border: "1px solid #222", borderRadius: 12,
            padding: "20px 24px",
          }}>
            <div style={{ fontSize: 22, color: "#c2a44a", marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: "#6b7280", textAlign: "center", padding: 60 }}>Carregando...</div>
      ) : forms.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "80px 24px",
          border: "1px dashed #2a2a2a", borderRadius: 16,
          color: "#6b7280",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>◫</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#9ca3af" }}>
            Nenhum formulário criado
          </div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>
            Crie seu primeiro formulário e comece a capturar leads.
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: "#c2a44a", color: "#0d0d0d", border: "none",
              borderRadius: 8, padding: "10px 22px", fontWeight: 700,
              fontSize: 14, cursor: "pointer",
            }}
          >
            + Criar Formulário
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {forms.map(f => {
            const st = STATUS_LABEL[f.status] ?? STATUS_LABEL.rascunho;
            return (
              <div key={f.id} style={{
                background: "#111", border: "1px solid #1e1e1e",
                borderRadius: 14, padding: "20px 24px",
                display: "flex", alignItems: "center", gap: 20,
                flexWrap: "wrap",
              }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{f.titulo}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px",
                      borderRadius: 20, background: `${st.color}18`, color: st.color,
                      border: `1px solid ${st.color}30`,
                    }}>{st.label}</span>
                  </div>
                  {f.descricao && (
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>{f.descricao}</div>
                  )}
                  <div style={{ fontSize: 12, color: "#4b5563" }}>
                    {f.total_respostas ?? 0} respostas · /f/{f.slug}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={`/dashboard/forms/${f.id}/editar`} style={btnStyle("#1a1a1a", "#9ca3af")}>
                    Editar
                  </Link>
                  <Link href={`/dashboard/forms/${f.id}/respostas`} style={btnStyle("#1a1a1a", "#9ca3af")}>
                    Respostas
                  </Link>
                  <a
                    href={`/f/${f.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={btnStyle("#1a1a1a", "#9ca3af")}
                  >
                    Ver ↗
                  </a>
                  {f.status !== "ativo" ? (
                    <button onClick={() => alterarStatus(f.id, "ativo")} style={btnStyle("#c2a44a18", "#c2a44a")}>
                      Ativar
                    </button>
                  ) : (
                    <button onClick={() => alterarStatus(f.id, "pausado")} style={btnStyle("#1a1a1a", "#6b7280")}>
                      Pausar
                    </button>
                  )}
                  <button onClick={() => deletarForm(f.id)} style={btnStyle("#2a1111", "#ef4444")}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal novo form */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: "#111", border: "1px solid #222",
            borderRadius: 16, padding: 32, width: "100%", maxWidth: 440,
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 20 }}>
              Novo Formulário
            </h2>
            <label style={{ display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 6 }}>
              Título do formulário *
            </label>
            <input
              autoFocus
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              onKeyDown={e => e.key === "Enter" && criarForm()}
              placeholder="Ex: Formulário de Interesse"
              style={{
                width: "100%", padding: "12px 14px",
                background: "#0d0d0d", border: "1px solid #2a2a2a",
                borderRadius: 8, color: "#fff", fontSize: 15,
                outline: "none", fontFamily: "inherit", marginBottom: 20,
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={btnStyle("#1a1a1a", "#6b7280")}>
                Cancelar
              </button>
              <button
                onClick={criarForm}
                disabled={criando || !titulo.trim()}
                style={{
                  background: "#c2a44a", color: "#0d0d0d", border: "none",
                  borderRadius: 8, padding: "10px 22px", fontWeight: 700,
                  fontSize: 14, cursor: "pointer", opacity: criando ? 0.6 : 1,
                }}
              >
                {criando ? "Criando..." : "Criar →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg, color, border: `1px solid ${color}25`,
    borderRadius: 7, padding: "7px 14px", fontSize: 13,
    cursor: "pointer", fontWeight: 600, textDecoration: "none",
    display: "inline-flex", alignItems: "center",
    fontFamily: "inherit",
  };
}

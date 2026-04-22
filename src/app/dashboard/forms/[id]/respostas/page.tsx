"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface Resposta {
  id: string;
  lead_id?: string;
  completude: number;
  concluido: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  criado_em: string;
  leads?: { nome?: string; email?: string; whatsapp?: string };
}

interface PerguntaStat {
  id: string;
  tipo: string;
  label: string;
  opcoes?: string[];
  ordem: number;
}

export default function RespostasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dados, setDados] = useState<{
    respostas: Resposta[];
    total: number;
    stats: Record<string, Record<string, number>>;
    perguntas_stats: PerguntaStat[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limite = 50;

  const carregar = (off = 0) => {
    setLoading(true);
    fetch(`/api/admin/forms/${id}/respostas?limite=${limite}&offset=${off}`)
      .then(r => r.json())
      .then(d => { setDados(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { carregar(0); }, [id]);

  const paginar = (dir: -1 | 1) => {
    const novoOffset = offset + dir * limite;
    setOffset(novoOffset);
    carregar(novoOffset);
  };

  const exportarCSV = () => {
    if (!dados) return;
    const header = ["Nome", "Email", "WhatsApp", "Completude", "UTM Source", "UTM Campaign", "Data"];
    const rows = dados.respostas.map(r => [
      r.leads?.nome ?? "", r.leads?.email ?? "", r.leads?.whatsapp ?? "",
      `${r.completude}%`, r.utm_source ?? "", r.utm_campaign ?? "",
      new Date(r.criado_em).toLocaleString("pt-BR"),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `respostas-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalRespostas = dados?.total ?? 0;
  const completudeMedia = dados?.respostas.length
    ? Math.round(dados.respostas.reduce((s, r) => s + r.completude, 0) / dados.respostas.length)
    : 0;

  return (
    <div style={{ padding: "32px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <Link href={`/dashboard/forms/${id}/editar`} style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>
          ← Editar
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>Respostas</h1>
        </div>
        <button onClick={exportarCSV} style={{
          background: "#1a1a1a", color: "#9ca3af", border: "1px solid #2a2a2a",
          borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          ↓ Exportar CSV
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Total de Respostas", val: totalRespostas },
          { label: "Completude Média", val: `${completudeMedia}%` },
          { label: "Esta Página", val: dados?.respostas.length ?? 0 },
        ].map(s => (
          <div key={s.label} style={{
            background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "18px 20px",
          }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stats por pergunta */}
      {dados?.perguntas_stats && dados.perguntas_stats.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
            Distribuição de Respostas
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {dados.perguntas_stats.map(p => {
              const st = dados.stats[p.id] ?? {};
              const total = Object.values(st).reduce((a, b) => a + b, 0);
              return (
                <div key={p.id} style={{
                  background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 18,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 12 }}>{p.label}</div>
                  {Object.entries(st).sort((a, b) => b[1] - a[1]).map(([op, cnt]) => {
                    const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                    return (
                      <div key={op} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af", marginBottom: 3 }}>
                          <span>{op}</span><span>{cnt} ({pct}%)</span>
                        </div>
                        <div style={{ height: 4, background: "#1e1e1e", borderRadius: 99 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "#c2a44a", borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(st).length === 0 && (
                    <div style={{ color: "#4b5563", fontSize: 12 }}>Sem respostas ainda.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div style={{ color: "#6b7280", textAlign: "center", padding: 60 }}>Carregando...</div>
      ) : !dados?.respostas.length ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#4b5563" }}>
          Nenhuma resposta ainda.
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
                  {["Nome", "E-mail", "WhatsApp", "Completude", "Origem", "Data"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#6b7280", fontWeight: 600, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.respostas.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #111" }}>
                    <td style={td}>{r.leads?.nome ?? <span style={{ color: "#4b5563" }}>—</span>}</td>
                    <td style={td}>{r.leads?.email ?? <span style={{ color: "#4b5563" }}>—</span>}</td>
                    <td style={td}>{r.leads?.whatsapp ?? <span style={{ color: "#4b5563" }}>—</span>}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: "#1e1e1e", borderRadius: 99, minWidth: 60 }}>
                          <div style={{ height: "100%", width: `${r.completude}%`, background: r.completude >= 80 ? "#4ade80" : r.completude >= 50 ? "#facc15" : "#ef4444", borderRadius: 99 }} />
                        </div>
                        <span style={{ color: "#9ca3af", minWidth: 34 }}>{r.completude}%</span>
                      </div>
                    </td>
                    <td style={td}>
                      {r.utm_source
                        ? <span style={{ background: "#1a1a1a", borderRadius: 4, padding: "2px 6px", fontSize: 11 }}>{r.utm_source}</span>
                        : <span style={{ color: "#4b5563" }}>—</span>
                      }
                    </td>
                    <td style={{ ...td, color: "#6b7280" }}>
                      {new Date(r.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              {offset + 1}–{Math.min(offset + limite, totalRespostas)} de {totalRespostas}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={offset === 0} onClick={() => paginar(-1)} style={pgBtn}>← Anterior</button>
              <button disabled={offset + limite >= totalRespostas} onClick={() => paginar(1)} style={pgBtn}>Próxima →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const td: React.CSSProperties = { padding: "11px 12px", color: "#d1d5db", verticalAlign: "middle" };
const pgBtn: React.CSSProperties = {
  background: "#111", border: "1px solid #2a2a2a", color: "#9ca3af",
  borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 13,
  fontFamily: "inherit",
};

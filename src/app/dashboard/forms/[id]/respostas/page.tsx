"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface Resposta {
  id: string; lead_id?: string; completude: number; concluido: boolean;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_term?: string; utm_content?: string; criado_em: string;
  leads?: { nome?: string; email?: string; whatsapp?: string };
}

interface PerguntaStat {
  id: string; tipo: string; label: string; opcoes?: string[]; ordem: number;
}

interface DetalheResposta {
  pergunta_id: string; tipo: string; label: string; valor: string;
}

interface Dados {
  respostas: Resposta[]; total: number;
  total_concluidos: number; total_abandonados: number;
  stats: Record<string, Record<string, number>>;
  perguntas_stats: PerguntaStat[];
}

export default function RespostasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [aba, setAba] = useState<"concluidas" | "abandonadas">("concluidas");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheResposta[] | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const limite = 50;

  const carregar = (off = 0, tab = aba) => {
    setLoading(true);
    const q = tab === "abandonadas" ? "&abandonados=1" : "";
    fetch(`/api/admin/forms/${id}/respostas?limite=${limite}&offset=${off}${q}`)
      .then(r => r.json())
      .then(d => { setDados(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { carregar(0, aba); }, [id, aba]);

  const paginar = (dir: -1 | 1) => {
    const novoOff = offset + dir * limite;
    setOffset(novoOff);
    carregar(novoOff, aba);
  };

  const abrirDetalhe = async (responseId: string) => {
    if (expandido === responseId) { setExpandido(null); setDetalhe(null); return; }
    setExpandido(responseId);
    setLoadingDetalhe(true);
    const r = await fetch(`/api/admin/forms/${id}/respostas?response_id=${responseId}`);
    const d = await r.json();
    setDetalhe(d.detalhes ?? []);
    setLoadingDetalhe(false);
  };

  const exportarCSV = () => {
    if (!dados) return;
    const header = ["Nome", "Email", "WhatsApp", "Completude", "UTM Source", "UTM Medium", "UTM Campaign", "UTM Term", "UTM Content", "Data"];
    const rows = dados.respostas.map(r => [
      r.leads?.nome ?? "", r.leads?.email ?? "", r.leads?.whatsapp ?? "",
      `${r.completude}%`, r.utm_source ?? "", r.utm_medium ?? "",
      r.utm_campaign ?? "", r.utm_term ?? "", r.utm_content ?? "",
      new Date(r.criado_em).toLocaleString("pt-BR"),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `respostas-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const completudeMedia = dados?.respostas.length
    ? Math.round(dados.respostas.reduce((s, r) => s + r.completude, 0) / dados.respostas.length)
    : 0;

  const taxaAbandono = dados && (dados.total_concluidos + dados.total_abandonados) > 0
    ? Math.round((dados.total_abandonados / (dados.total_concluidos + dados.total_abandonados)) * 100)
    : 0;

  return (
    <div style={{ padding: "32px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <Link href={`/dashboard/forms/${id}/editar`} style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← Editar</Link>
        <h1 style={{ flex: 1, fontSize: 22, fontWeight: 700, color: "#fff" }}>Respostas</h1>
        <button onClick={exportarCSV} style={btnSec}>↓ Exportar CSV</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Concluídas", val: dados?.total_concluidos ?? 0, color: "#4ade80" },
          { label: "Abandonadas", val: dados?.total_abandonados ?? 0, color: "#f87171" },
          { label: "Taxa de abandono", val: `${taxaAbandono}%`, color: taxaAbandono > 50 ? "#f87171" : "#facc15" },
          { label: "Completude média", val: `${completudeMedia}%`, color: "#c2a44a" },
        ].map(s => (
          <div key={s.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Gráficos de distribuição */}
      {dados?.perguntas_stats && dados.perguntas_stats.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
            Distribuição de Respostas
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {dados.perguntas_stats.map(p => {
              const st = dados.stats[p.id] ?? {};
              const total = Object.values(st).reduce((a, b) => a + b, 0);
              return (
                <div key={p.id} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 10 }}>{p.label}</div>
                  {Object.entries(st).sort((a, b) => b[1] - a[1]).map(([op, cnt]) => {
                    const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                    return (
                      <div key={op} style={{ marginBottom: 7 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af", marginBottom: 3 }}>
                          <span>{op}</span><span>{cnt} ({pct}%)</span>
                        </div>
                        <div style={{ height: 4, background: "#1e1e1e", borderRadius: 99 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "#c2a44a", borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(st).length === 0 && <div style={{ color: "#4b5563", fontSize: 12 }}>Sem respostas ainda.</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Abas concluídas / abandonadas */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["concluidas", "abandonadas"] as const).map(t => (
          <button key={t} onClick={() => { setAba(t); setOffset(0); setExpandido(null); }} style={{
            background: aba === t ? "#1a1a1a" : "transparent",
            border: `1px solid ${aba === t ? "#2a2a2a" : "transparent"}`,
            color: aba === t ? "#fff" : "#6b7280",
            borderRadius: 7, padding: "6px 14px", fontSize: 13,
            cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
          }}>
            {t === "concluidas" ? `Concluídas (${dados?.total_concluidos ?? 0})` : `Abandonadas (${dados?.total_abandonados ?? 0})`}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ color: "#6b7280", textAlign: "center", padding: 60 }}>Carregando...</div>
      ) : !dados?.respostas.length ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#4b5563" }}>Nenhuma resposta encontrada.</div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
                  {["Nome", "E-mail", "WhatsApp", "Completude", "UTM Source", "Data", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#6b7280", fontWeight: 600, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.respostas.map(r => (
                  <>
                    <tr key={r.id} style={{ borderBottom: expandido === r.id ? "none" : "1px solid #111", cursor: "pointer" }}
                      onClick={() => abrirDetalhe(r.id)}>
                      <td style={td}>{r.leads?.nome ?? <Em>—</Em>}</td>
                      <td style={td}>{r.leads?.email ?? <Em>—</Em>}</td>
                      <td style={td}>{r.leads?.whatsapp ?? <Em>—</Em>}</td>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: "#1e1e1e", borderRadius: 99, minWidth: 50 }}>
                            <div style={{ height: "100%", width: `${r.completude}%`, background: r.completude >= 80 ? "#4ade80" : r.completude >= 50 ? "#facc15" : "#ef4444", borderRadius: 99 }} />
                          </div>
                          <span style={{ color: "#9ca3af", minWidth: 32 }}>{r.completude}%</span>
                        </div>
                      </td>
                      <td style={td}>{r.utm_source ? <Tag>{r.utm_source}</Tag> : <Em>—</Em>}</td>
                      <td style={{ ...td, color: "#6b7280" }}>
                        {new Date(r.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={td}>
                        <span style={{ color: "#6b7280", fontSize: 11 }}>{expandido === r.id ? "▲" : "▼"} detalhes</span>
                      </td>
                    </tr>
                    {expandido === r.id && (
                      <tr key={`${r.id}-det`}>
                        <td colSpan={7} style={{ padding: "0 12px 16px", background: "#0d0d0d", borderBottom: "1px solid #1e1e1e" }}>
                          {loadingDetalhe ? (
                            <div style={{ color: "#6b7280", fontSize: 13, padding: "12px 0" }}>Carregando respostas...</div>
                          ) : detalhe && detalhe.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12 }}>
                              {detalhe.map((d, i) => (
                                <div key={i} style={{ display: "flex", gap: 12, fontSize: 13 }}>
                                  <span style={{ color: "#6b7280", minWidth: 240, flexShrink: 0 }}>{d.label}</span>
                                  <span style={{ color: d.valor ? "#fff" : "#4b5563" }}>{d.valor || "—"}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: "#4b5563", fontSize: 13, paddingTop: 12 }}>Sem respostas salvas para esta submissão.</div>
                          )}
                          {/* UTMs extras */}
                          {(r.utm_medium || r.utm_campaign || r.utm_term || r.utm_content) && (
                            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1a1a1a", display: "flex", gap: 10, flexWrap: "wrap" }}>
                              {[
                                { k: "medium", v: r.utm_medium }, { k: "campaign", v: r.utm_campaign },
                                { k: "term", v: r.utm_term }, { k: "content", v: r.utm_content },
                              ].filter(u => u.v).map(u => (
                                <span key={u.k} style={{ fontSize: 11, background: "#1a1a1a", borderRadius: 4, padding: "2px 7px", color: "#9ca3af" }}>
                                  {u.k}: <strong style={{ color: "#c2a44a" }}>{u.v}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              {offset + 1}–{Math.min(offset + limite, dados.total)} de {dados.total}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={offset === 0} onClick={() => paginar(-1)} style={pgBtn}>← Anterior</button>
              <button disabled={offset + limite >= dados.total} onClick={() => paginar(1)} style={pgBtn}>Próxima →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#4b5563" }}>{children}</span>;
}
function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ background: "#1a1a1a", borderRadius: 4, padding: "2px 6px", fontSize: 11, color: "#9ca3af" }}>{children}</span>;
}

const td: React.CSSProperties = { padding: "11px 12px", color: "#d1d5db", verticalAlign: "middle" };
const btnSec: React.CSSProperties = { background: "#111", border: "1px solid #2a2a2a", color: "#9ca3af", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const pgBtn: React.CSSProperties = { background: "#111", border: "1px solid #2a2a2a", color: "#9ca3af", borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" };
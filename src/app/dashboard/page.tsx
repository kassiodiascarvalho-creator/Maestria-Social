import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const revalidate = 60; // revalida a cada 1 min

// ─── helpers ──────────────────────────────────────────────────────────
function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}
function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}
function delta(atual: number, anterior: number) {
  if (!anterior) return null;
  const d = Math.round(((atual - anterior) / anterior) * 100);
  return d;
}

// ─── page ─────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const db = createAdminClient() as any;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const semanaAtras = new Date(hoje);
  semanaAtras.setDate(semanaAtras.getDate() - 7);
  const duasHorasAtras = new Date(Date.now() - 2 * 3600e3).toISOString();
  const tresDialAtras = new Date(Date.now() - 3 * 86400e3).toISOString();

  // ── Queries paralelas ─────────────────────────────────────────────
  const [
    { count: totalLeads },
    { count: leadsHoje },
    { count: leadsOntem },
    { count: leadsSemana },
    { count: quentes },
    { count: mornos },
    { count: frios },
    { count: alertasQuentes },
    { count: leadsFriosAcumulados },
    { count: flowsAtivos },
    { count: formsAtivos },
    { data: leadsAnalytics },
    { data: campanhas },
    { data: agentes },
    { data: flowsList },
  ] = await Promise.all([
    db.from("leads").select("*", { count: "exact", head: true }),
    db.from("leads").select("*", { count: "exact", head: true }).gte("criado_em", hoje.toISOString()),
    db.from("leads").select("*", { count: "exact", head: true }).gte("criado_em", ontem.toISOString()).lt("criado_em", hoje.toISOString()),
    db.from("leads").select("*", { count: "exact", head: true }).gte("criado_em", semanaAtras.toISOString()),
    db.from("leads").select("*", { count: "exact", head: true }).eq("status_lead", "quente"),
    db.from("leads").select("*", { count: "exact", head: true }).eq("status_lead", "morno"),
    db.from("leads").select("*", { count: "exact", head: true }).eq("status_lead", "frio"),
    // leads quentes sem resposta há mais de 2h
    db.from("leads").select("*", { count: "exact", head: true }).eq("status_lead", "quente").lt("atualizado_em", duasHorasAtras),
    // leads frios acumulando há mais de 3 dias sem ação
    db.from("leads").select("*", { count: "exact", head: true }).eq("status_lead", "frio").lt("criado_em", tresDialAtras),
    db.from("cadencia_flows").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    db.from("forms").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    // amostra para análise de origem e scores
    db.from("leads").select("origem, status_lead, score_email, agente_id, pipeline_etapa, criado_em").order("criado_em", { ascending: false }).limit(2000),
    // campanhas de email
    db.from("email_campanhas").select("id, assunto_a, status, total_enviados, total_abertos, total_cliques, criado_em").order("criado_em", { ascending: false }).limit(20),
    // agentes
    db.from("agentes").select("id, nome").order("criado_em", { ascending: true }),
    // fluxos de cadência ativos
    db.from("cadencia_flows").select("id, nome, total_execucoes, trigger_tipo").eq("status", "ativo").limit(5),
  ]);

  // ── Processamento em JS ───────────────────────────────────────────
  const leads: Array<{ origem: string; status_lead: string; score_email: number; agente_id: string | null; pipeline_etapa: string | null }> = leadsAnalytics ?? [];

  // Funil
  const total = totalLeads ?? 0;
  const nQuentes = quentes ?? 0;
  const nMornos = mornos ?? 0;
  const nFrios = frios ?? 0;

  // Origem breakdown
  const origemMap = new Map<string, { total: number; quentes: number; mornos: number }>();
  for (const l of leads) {
    const o = l.origem?.trim() || "Direto";
    if (!origemMap.has(o)) origemMap.set(o, { total: 0, quentes: 0, mornos: 0 });
    const ent = origemMap.get(o)!;
    ent.total++;
    if (l.status_lead === "quente") ent.quentes++;
    if (l.status_lead === "morno") ent.mornos++;
  }
  const origens = Array.from(origemMap.entries())
    .map(([nome, d]) => ({ nome, ...d, conv: pct(d.quentes, d.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Melhor origem por conversão (min 5 leads)
  const melhorOrigem = origens.filter(o => o.total >= 5).sort((a, b) => b.conv - a.conv)[0];
  const piorOrigem = origens.filter(o => o.total >= 5).sort((a, b) => a.conv - b.conv)[0];

  // Score médio email
  const comScore = leads.filter(l => l.score_email > 0);
  const scoreMedio = comScore.length
    ? Math.round(comScore.reduce((s, l) => s + (l.score_email ?? 0), 0) / comScore.length)
    : 0;

  // Agentes breakdown
  const agenteMap = new Map<string, { total: number; quentes: number }>();
  for (const l of leads) {
    if (!l.agente_id) continue;
    if (!agenteMap.has(l.agente_id)) agenteMap.set(l.agente_id, { total: 0, quentes: 0 });
    const ent = agenteMap.get(l.agente_id)!;
    ent.total++;
    if (l.status_lead === "quente") ent.quentes++;
  }
  const agentesData = (agentes ?? []).map((a: { id: string; nome: string }) => ({
    ...a,
    ...( agenteMap.get(a.id) ?? { total: 0, quentes: 0 }),
  })).filter((a: any) => a.total > 0);

  // Email stats
  const camp = (campanhas ?? []) as Array<{ id: string; assunto_a: string; status: string; total_enviados: number; total_abertos: number; total_cliques: number }>;
  const campEnviadas = camp.filter(c => ["enviado", "enviando"].includes(c.status));
  const totalEnviadosEmail = campEnviadas.reduce((s, c) => s + (c.total_enviados ?? 0), 0);
  const totalAbertosEmail = campEnviadas.reduce((s, c) => s + (c.total_abertos ?? 0), 0);
  const totalCliquesEmail = campEnviadas.reduce((s, c) => s + (c.total_cliques ?? 0), 0);
  const taxaAberturaGlobal = pct(totalAbertosEmail, totalEnviadosEmail);
  const taxaCliqueGlobal = pct(totalCliquesEmail, totalEnviadosEmail);
  const melhorCampanha = campEnviadas
    .filter(c => c.total_enviados >= 5)
    .sort((a, b) => pct(b.total_abertos, b.total_enviados) - pct(a.total_abertos, a.total_enviados))[0];

  // Delta leads hoje vs ontem
  const deltaHoje = delta(leadsHoje ?? 0, leadsOntem ?? 0);

  // Pipeline etapas
  const etapaMap = new Map<string, number>();
  for (const l of leads) {
    if (!l.pipeline_etapa) continue;
    etapaMap.set(l.pipeline_etapa, (etapaMap.get(l.pipeline_etapa) ?? 0) + 1);
  }
  const etapas = Array.from(etapaMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Alertas
  const alertas: Array<{ cor: string; icon: string; texto: string; link?: string }> = [];
  if ((alertasQuentes ?? 0) > 0) {
    alertas.push({ cor: "#ef4444", icon: "🔥", texto: `${alertasQuentes} lead${alertasQuentes !== 1 ? "s" : ""} quente${alertasQuentes !== 1 ? "s" : ""} sem resposta há mais de 2h`, link: "/dashboard/leads?status=quente" });
  }
  if ((leadsFriosAcumulados ?? 0) > 0) {
    alertas.push({ cor: "#6b7280", icon: "❄️", texto: `${leadsFriosAcumulados} lead${leadsFriosAcumulados !== 1 ? "s" : ""} frio${leadsFriosAcumulados !== 1 ? "s" : ""} sem ação há mais de 3 dias`, link: "/dashboard/leads?status=frio" });
  }
  if (melhorOrigem) {
    alertas.push({ cor: "#22c55e", icon: "🎯", texto: `Melhor canal: "${melhorOrigem.nome}" com ${melhorOrigem.conv}% de conversão (${melhorOrigem.quentes} quentes de ${melhorOrigem.total})` });
  }
  if (melhorCampanha) {
    const taxa = pct(melhorCampanha.total_abertos, melhorCampanha.total_enviados);
    alertas.push({ cor: "#c2a44a", icon: "✉", texto: `Campanha de email mais engajada: "${melhorCampanha.assunto_a}" — ${taxa}% de abertura` });
  }
  if (piorOrigem && piorOrigem.nome !== melhorOrigem?.nome) {
    alertas.push({ cor: "#f97316", icon: "⚠", texto: `Canal com menor conversão: "${piorOrigem.nome}" (${piorOrigem.conv}%) — considere revisar a abordagem` });
  }
  if (taxaAberturaGlobal > 0 && taxaAberturaGlobal < 20) {
    alertas.push({ cor: "#f97316", icon: "📉", texto: `Taxa de abertura de emails abaixo de 20% (${taxaAberturaGlobal}%) — revise assuntos das campanhas` });
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "32px 32px 80px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 700, color: "#fff9e6", marginBottom: 4 }}>
          Visão Geral
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280" }}>
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Total de Leads", val: fmt(total), sub: null, cor: "#c2a44a", link: "/dashboard/leads" },
          { label: "Leads Hoje", val: fmt(leadsHoje ?? 0), sub: deltaHoje !== null ? `${deltaHoje >= 0 ? "+" : ""}${deltaHoje}% vs ontem` : null, cor: deltaHoje !== null && deltaHoje >= 0 ? "#22c55e" : "#ef4444", link: null },
          { label: "Esta Semana", val: fmt(leadsSemana ?? 0), sub: null, cor: "#fff", link: null },
          { label: "Leads Quentes", val: fmt(nQuentes), sub: `${pct(nQuentes, total)}% do total`, cor: "#ef4444", link: "/dashboard/leads?status=quente" },
          { label: "Leads Mornos", val: fmt(nMornos), sub: `${pct(nMornos, total)}% do total`, cor: "#f97316", link: "/dashboard/leads?status=morno" },
          { label: "Score Email Médio", val: scoreMedio > 0 ? `${scoreMedio} pts` : "—", sub: "engajamento via email", cor: "#10b981", link: null },
          { label: "Cadências Ativas", val: fmt(flowsAtivos ?? 0), sub: null, cor: "#a855f7", link: "/dashboard/cadencia" },
          { label: "Formulários Ativos", val: fmt(formsAtivos ?? 0), sub: null, cor: "#3b82f6", link: "/dashboard/forms" },
        ].map(k => (
          <KPICard key={k.label} {...k} />
        ))}
      </div>

      {/* ── Funil de Leads ─────────────────────────────────────────── */}
      <Section titulo="🔥 Funil de Leads" sub={`${fmt(total)} leads no total`}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e" }}>
          {[
            { label: "Frios", val: nFrios, cor: "#3b82f6", bg: "#3b82f610", prox: nMornos },
            { label: "Mornos", val: nMornos, cor: "#f97316", bg: "#f9731610", prox: nQuentes },
            { label: "Quentes", val: nQuentes, cor: "#ef4444", bg: "#ef444410", prox: null },
          ].map((e, i) => (
            <div key={e.label} style={{ flex: Math.max(e.val, 1), background: e.bg, borderRight: i < 2 ? "1px solid #1e1e1e" : "none", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 6, minWidth: 90 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: e.cor }}>{fmt(e.val)}</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{e.label}</div>
              <div style={{ fontSize: 11, color: "#4b5563" }}>{pct(e.val, total)}% do total</div>
              {e.prox !== null && e.val > 0 && (
                <div style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>
                  → {pct(e.prox, e.val)}% avançam
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pipeline etapas */}
        {etapas.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Etapas do Pipeline</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {etapas.map(([etapa, cnt]) => (
                <div key={etapa} style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
                  <span style={{ color: "#c2a44a", fontWeight: 700 }}>{cnt}</span>
                  <span style={{ color: "#6b7280", marginLeft: 6 }}>{etapa}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Grid: Origens + Email ──────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Origens */}
        <Section titulo="🎯 Origem de Leads" sub="conversão = % que virou quente">
          {origens.length === 0 ? (
            <Empty txt="Nenhuma origem registrada ainda" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e1e1e" }}>
                  {["Origem", "Leads", "Quentes", "Conv."].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, color: "#4b5563", fontWeight: 600, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {origens.map((o, i) => (
                  <tr key={o.nome} style={{ borderBottom: "1px solid #111", background: i % 2 === 0 ? "transparent" : "#0a0a0a" }}>
                    <td style={{ padding: "9px 8px", color: "#d1d5db", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.nome}</td>
                    <td style={{ padding: "9px 8px", color: "#9ca3af" }}>{fmt(o.total)}</td>
                    <td style={{ padding: "9px 8px", color: "#ef4444" }}>{fmt(o.quentes)}</td>
                    <td style={{ padding: "9px 8px" }}>
                      <span style={{ background: o.conv >= 20 ? "#22c55e20" : o.conv >= 10 ? "#f9731620" : "#6b728020", color: o.conv >= 20 ? "#22c55e" : o.conv >= 10 ? "#f97316" : "#6b7280", borderRadius: 5, padding: "2px 7px", fontWeight: 700 }}>
                        {o.conv}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Email */}
        <Section titulo="✉ Performance de Email" sub={`${campEnviadas.length} campanha${campEnviadas.length !== 1 ? "s" : ""} enviada${campEnviadas.length !== 1 ? "s" : ""}`}>
          {campEnviadas.length === 0 ? (
            <Empty txt="Nenhuma campanha enviada ainda" link="/dashboard/emails" linkTxt="Ir para Emails" />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Enviados", val: fmt(totalEnviadosEmail), cor: "#fff" },
                  { label: "Taxa Abertura", val: `${taxaAberturaGlobal}%`, cor: taxaAberturaGlobal >= 25 ? "#22c55e" : taxaAberturaGlobal >= 15 ? "#f97316" : "#ef4444" },
                  { label: "Taxa Clique", val: `${taxaCliqueGlobal}%`, cor: taxaCliqueGlobal >= 5 ? "#22c55e" : "#f97316" },
                ].map(m => (
                  <div key={m.label} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: m.cor }}>{m.val}</div>
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3 }}>{m.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Campanhas Recentes</div>
              {camp.slice(0, 5).map(c => {
                const taxa = pct(c.total_abertos, c.total_enviados);
                return (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #111", fontSize: 12 }}>
                    <span style={{ color: "#9ca3af", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.assunto_a}</span>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <span style={{ color: "#6b7280" }}>{fmt(c.total_enviados ?? 0)} env.</span>
                      <span style={{ color: taxa >= 25 ? "#22c55e" : "#f97316", fontWeight: 600 }}>{taxa}% ab.</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </Section>
      </div>

      {/* ── Alertas Inteligentes ────────────────────────────────────── */}
      {alertas.length > 0 && (
        <Section titulo="💡 Insights & Alertas" sub="baseado nos dados atuais">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertas.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: `${a.cor}08`, border: `1px solid ${a.cor}30`, borderRadius: 10, padding: "12px 16px" }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
                <span style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.5, flex: 1 }}>{a.texto}</span>
                {a.link && (
                  <Link href={a.link} style={{ fontSize: 12, color: a.cor, textDecoration: "none", flexShrink: 0, border: `1px solid ${a.cor}40`, borderRadius: 6, padding: "3px 10px", whiteSpace: "nowrap" }}>
                    Ver →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Agentes ─────────────────────────────────────────────────── */}
      {agentesData.length > 0 && (
        <Section titulo="🤖 Performance dos Agentes" sub="leads atribuídos e convertidos">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {agentesData.map((a: any) => (
              <div key={a.id} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#a855f7", marginBottom: 10 }}>{a.nome}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#6b7280" }}>Leads</span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{fmt(a.total)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
                  <span style={{ color: "#6b7280" }}>Quentes</span>
                  <span style={{ color: "#ef4444", fontWeight: 600 }}>{fmt(a.quentes)}</span>
                </div>
                <div style={{ marginTop: 10, height: 4, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${pct(a.quentes, a.total)}%`, height: "100%", background: "#a855f7", borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>{pct(a.quentes, a.total)}% de conversão</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Cadências Ativas ─────────────────────────────────────────── */}
      {(flowsList ?? []).length > 0 && (
        <Section titulo="⚡ Cadências em Andamento" sub={`${flowsAtivos ?? 0} fluxo${(flowsAtivos ?? 0) !== 1 ? "s" : ""} ativo${(flowsAtivos ?? 0) !== 1 ? "s" : ""}`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {(flowsList as Array<{ id: string; nome: string; total_execucoes: number; trigger_tipo: string }>).map(f => (
              <Link key={f.id} href={`/dashboard/cadencia/${f.id}`} style={{ background: "#0d0d0d", border: "1px solid #a855f730", borderRadius: 10, padding: "12px 16px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#a855f7" }}>{f.nome}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{fmt(f.total_execucoes ?? 0)} execuções</span>
                <span style={{ fontSize: 11, color: "#374151" }}>⚡ {f.trigger_tipo}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────
function Section({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: "22px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{titulo}</span>
        {sub && <span style={{ fontSize: 12, color: "#4b5563" }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function KPICard({ label, val, sub, cor, link }: { label: string; val: string; sub: string | null; cor: string; link: string | null }) {
  const inner = (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: cor, lineHeight: 1, marginBottom: 6 }}>{val}</div>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: sub ? 4 : 0 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: cor, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
  return link ? <Link href={link} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}

function Empty({ txt, link, linkTxt }: { txt: string; link?: string; linkTxt?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0", color: "#4b5563", fontSize: 13 }}>
      {txt}
      {link && <><br /><Link href={link} style={{ color: "#c2a44a", marginTop: 8, display: "inline-block" }}>{linkTxt}</Link></>}
    </div>
  );
}

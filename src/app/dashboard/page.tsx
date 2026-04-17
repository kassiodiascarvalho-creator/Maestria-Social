import { createAdminClient } from "@/lib/supabase/admin";
import RealtimeRefresher from "@/components/RealtimeRefresher";

export default async function DashboardPage() {
  const supabase = createAdminClient();

  const [{ count: total }, { count: quentes }, { count: mornos }, { count: frios }] =
    await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status_lead", "quente"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status_lead", "morno"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("status_lead", "frio"),
    ]);

  const stats = [
    { label: "Total de Leads", value: total ?? 0, color: "#c2904d" },
    { label: "Quentes 🔴", value: quentes ?? 0, color: "#e07070" },
    { label: "Mornos 🟡", value: mornos ?? 0, color: "#d4a055" },
    { label: "Frios 🔵", value: frios ?? 0, color: "#7a9ec0" },
  ];

  return (
    <>
      <RealtimeRefresher table="leads" event="*" throttleMs={2000} />
      <style>{css}</style>
      <div className="db-page">
        <div className="db-header">
          <h1 className="db-title">Visão Geral</h1>
          <p className="db-sub">Resumo da plataforma Maestria Social</p>
        </div>

        <div className="db-stats">
          {stats.map((s) => (
            <div key={s.label} className="db-stat">
              <span className="db-stat-val" style={{ color: s.color }}>{s.value}</span>
              <span className="db-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="db-notice">
          <span className="db-notice-icon">◆</span>
          Use o menu lateral para gerenciar leads, configurar o agente SDR e as integrações.
        </div>
      </div>
    </>
  );
}

const css = `
  .db-page{padding:40px;}
  .db-header{margin-bottom:36px;}
  .db-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:700;color:#fff9e6;margin-bottom:6px;}
  .db-sub{font-size:14px;color:#7a6e5e;font-weight:300;}
  .db-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px;}
  .db-stat{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px 28px;}
  .db-stat-val{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size:48px;font-weight:700;line-height:1;margin-bottom:8px;}
  .db-stat-label{font-size:12px;color:#7a6e5e;font-weight:500;letter-spacing:.5px;text-transform:uppercase;}
  .db-notice{display:flex;align-items:flex-start;gap:10px;background:rgba(194,144,77,.05);border:1px solid rgba(194,144,77,.15);border-radius:12px;padding:16px 20px;font-size:14px;color:#7a6e5e;line-height:1.6;}
  .db-notice-icon{color:#c2904d;font-size:8px;margin-top:4px;flex-shrink:0;}
`;

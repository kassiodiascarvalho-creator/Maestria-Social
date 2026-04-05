import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = {
  quente: "#e07070",
  morno: "#d4a055",
  frio: "#7a9ec0",
};
const STATUS_EMOJI: Record<string, string> = {
  quente: "🔴",
  morno: "🟡",
  frio: "🔵",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pilar?: string; nivel?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("leads")
    .select("id,nome,email,whatsapp,status_lead,nivel_qs,pilar_fraco,qs_total,criado_em")
    .order("criado_em", { ascending: false });

  if (params.status) query = query.eq("status_lead", params.status as "frio" | "morno" | "quente");
  if (params.nivel) query = query.eq("nivel_qs", params.nivel as "Negligente" | "Iniciante" | "Intermediário" | "Avançado" | "Mestre");
  if (params.pilar) query = query.eq("pilar_fraco", params.pilar);
  if (params.q) query = query.ilike("nome", `%${params.q}%`);

  const { data: leads } = await query.limit(100);

  return (
    <>
      <style>{css}</style>
      <div className="leads-page">
        <div className="leads-header">
          <h1 className="leads-title">Leads</h1>
          <p className="leads-sub">{leads?.length ?? 0} resultado(s)</p>
        </div>

        {/* Filtros */}
        <form className="filters" method="GET">
          <input className="filter-input" name="q" defaultValue={params.q} placeholder="Buscar por nome…" />
          <select className="filter-select" name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos os status</option>
            <option value="quente">🔴 Quente</option>
            <option value="morno">🟡 Morno</option>
            <option value="frio">🔵 Frio</option>
          </select>
          <select className="filter-select" name="nivel" defaultValue={params.nivel ?? ""}>
            <option value="">Todos os níveis</option>
            {["Negligente","Iniciante","Intermediário","Avançado","Mestre"].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select className="filter-select" name="pilar" defaultValue={params.pilar ?? ""}>
            <option value="">Todos os pilares</option>
            {["Sociabilidade","Comunicação","Relacionamento","Persuasão","Influência"].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="filter-btn" type="submit">Filtrar</button>
          <Link className="filter-clear" href="/dashboard/leads">Limpar</Link>
        </form>

        {/* Tabela */}
        <div className="leads-table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>WhatsApp</th>
                <th>QS</th>
                <th>Nível</th>
                <th>Pilar Fraco</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads && leads.length > 0 ? leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="td-nome">
                    <span className="lead-avatar">{lead.nome.charAt(0).toUpperCase()}</span>
                    <span>{lead.nome}</span>
                  </td>
                  <td className="td-muted">{lead.whatsapp}</td>
                  <td className="td-qs">{lead.qs_total ?? "—"}</td>
                  <td className="td-muted">{lead.nivel_qs ?? "—"}</td>
                  <td className="td-muted">{lead.pilar_fraco ?? "—"}</td>
                  <td>
                    <span className="status-badge" style={{ color: STATUS_COLOR[lead.status_lead] }}>
                      {STATUS_EMOJI[lead.status_lead]} {lead.status_lead}
                    </span>
                  </td>
                  <td className="td-muted">{new Date(lead.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <Link className="lead-link" href={`/dashboard/leads/${lead.id}`}>Ver →</Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="td-empty">Nenhum lead encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const css = `
  .leads-page{padding:40px;}
  .leads-header{margin-bottom:28px;}
  .leads-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:700;color:#fff9e6;margin-bottom:4px;}
  .leads-sub{font-size:13px;color:#7a6e5e;}
  .filters{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px;align-items:center;}
  .filter-input,.filter-select{background:#1a1410;border:1px solid #2a1f18;border-radius:10px;padding:9px 14px;font-size:13px;color:#fff9e6;font-family:inherit;outline:none;transition:border-color .2s;}
  .filter-input{min-width:200px;}
  .filter-input::placeholder{color:#4a3e30;}
  .filter-input:focus,.filter-select:focus{border-color:rgba(194,144,77,.4);}
  .filter-select option{background:#1a1410;}
  .filter-btn{background:#c2904d;color:#0e0f09;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .15s;}
  .filter-btn:hover{filter:brightness(1.08);}
  .filter-clear{font-size:13px;color:#7a6e5e;text-decoration:none;padding:9px 4px;transition:color .15s;}
  .filter-clear:hover{color:#c2904d;}
  .leads-table-wrap{overflow-x:auto;border-radius:16px;border:1px solid #2a1f18;}
  .leads-table{width:100%;border-collapse:collapse;font-size:14px;}
  .leads-table th{background:#111009;padding:12px 16px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#4a3e30;border-bottom:1px solid #2a1f18;white-space:nowrap;}
  .leads-table td{padding:14px 16px;border-bottom:1px solid rgba(42,31,24,.5);}
  .leads-table tr:last-child td{border-bottom:none;}
  .leads-table tr:hover td{background:rgba(255,255,255,.015);}
  .td-nome{display:flex;align-items:center;gap:10px;}
  .lead-avatar{width:32px;height:32px;border-radius:50%;background:rgba(194,144,77,.15);border:1px solid rgba(194,144,77,.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#c2904d;flex-shrink:0;}
  .td-muted{color:#7a6e5e;}
  .td-qs{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:700;color:#c2904d;}
  .status-badge{font-size:12px;font-weight:600;letter-spacing:.3px;text-transform:capitalize;}
  .td-empty{text-align:center;padding:48px 16px;color:#4a3e30;font-style:italic;}
  .lead-link{font-size:13px;color:#c2904d;text-decoration:none;font-weight:600;opacity:.7;transition:opacity .15s;}
  .lead-link:hover{opacity:1;}
  @media(max-width:768px){.leads-page{padding:20px;}}
`;

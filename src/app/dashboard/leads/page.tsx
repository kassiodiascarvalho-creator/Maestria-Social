import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import RealtimeRefresher from "@/components/RealtimeRefresher";
import LeadsTabela from "./LeadsTabela";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pilar?: string; nivel?: string; renda?: string; q?: string; etiqueta?: string; origem?: string; pipeline?: string }>
}) {
  const params = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Busca etapas do pipeline para o filtro
  const { data: etapas } = await supabase
    .from("pipeline_etapas")
    .select("slug,label,emoji,cor")
    .order("ordem")

  // Busca origens distintas para o dropdown
  const { data: origensRaw } = await supabase
    .from("leads")
    .select("origem")
    .not("origem", "is", null)
    .order("origem")
  const origensUnicas: string[] = [
    ...new Set(
      ((origensRaw ?? []) as Array<{ origem: string }>)
        .map(o => o.origem)
        .filter(Boolean)
    ),
  ]

  // Busca agentes para o seletor de reengajamento
  const { data: agentes } = await supabase
    .from("agentes")
    .select("id,nome,nome_persona")
    .order("nome")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("leads")
    .select("id,nome,email,whatsapp,status_lead,nivel_qs,pilar_fraco,qs_total,renda_mensal,criado_em,etiqueta,origem,pipeline_etapa")
    .order("criado_em", { ascending: false });

  const status = params.status?.trim();
  const nivel = params.nivel?.trim();
  const pilar = params.pilar?.trim();
  const renda = params.renda?.trim();
  const q = params.q?.trim();
  const etiqueta = params.etiqueta?.trim();
  const origem = params.origem?.trim();
  const pipeline = params.pipeline?.trim();

  if (status) query = query.eq("status_lead", status as "frio" | "morno" | "quente");
  if (nivel) query = query.eq("nivel_qs", nivel as "Negligente" | "Iniciante" | "Intermediário" | "Avançado" | "Mestre");
  if (pilar) query = query.eq("pilar_fraco", pilar);
  if (renda) query = query.eq("renda_mensal", renda);
  if (q) query = query.ilike("nome", `%${q}%`);
  if (etiqueta === "ia_atendendo") query = query.or("etiqueta.eq.ia_atendendo,etiqueta.is.null");
  else if (etiqueta) query = query.eq("etiqueta", etiqueta);
  if (origem) query = query.ilike("origem", `%${origem}%`);
  if (pipeline === "__sem_pipeline__") query = query.is("pipeline_etapa", null);
  else if (pipeline) query = query.eq("pipeline_etapa", pipeline);

  const { data: leads } = await query.limit(200);

  return (
    <>
      <style>{css}</style>
      <div className="leads-page">
        <RealtimeRefresher table="leads" event="*" throttleMs={1500} />
        <div className="leads-header">
          <h1 className="leads-title">Leads</h1>
          <p className="leads-sub">{leads?.length ?? 0} resultado(s)</p>
        </div>

        {/* Filtros */}
        <form className="filters" method="GET">
          <input className="filter-input" name="q" defaultValue={params.q} placeholder="Buscar por nome…" />
          <select className="filter-select" name="origem" defaultValue={params.origem ?? ""}>
            <option value="">Todas as origens</option>
            {origensUnicas.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select className="filter-select" name="status" defaultValue={params.status ?? ""}>
            <option value="">Todos os status</option>
            <option value="quente">🔴 Quente</option>
            <option value="morno">🟡 Morno</option>
            <option value="frio">🔵 Frio</option>
          </select>
          <select className="filter-select" name="etiqueta" defaultValue={params.etiqueta ?? ""}>
            <option value="">Todas as etiquetas</option>
            <option value="ia_atendendo">IA atendendo</option>
            <option value="humano_atendendo">Humano atendendo</option>
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
          <select className="filter-select" name="renda" defaultValue={params.renda ?? ""}>
            <option value="">Todas as rendas</option>
            {["Até R$ 3.000","R$ 3.000 – R$ 7.000","R$ 7.000 – R$ 15.000","R$ 15.000 – R$ 30.000","Acima de R$ 30.000"].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select className="filter-select" name="pipeline" defaultValue={params.pipeline ?? ""}>
            <option value="">Todos os pipelines</option>
            <option value="__sem_pipeline__">— Sem pipeline</option>
            {((etapas ?? []) as Array<{ slug: string; label: string; emoji: string | null; cor: string }>).map(e => (
              <option key={e.slug} value={e.slug}>{e.emoji ? `${e.emoji} ` : ""}{e.label}</option>
            ))}
          </select>
          <button className="filter-btn" type="submit">Filtrar</button>
          <Link className="filter-clear" href="/dashboard/leads">Limpar</Link>
        </form>

        {/* Tabela com seleção e reengajamento */}
        <LeadsTabela leads={leads ?? []} agentes={agentes ?? []} />
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
  .filter-select{appearance:none;background-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23c2904d' d='M6 8L0 0h12z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;cursor:pointer;}
  .filter-select option{background:#1a1410;color:#fff9e6;padding:8px;}
  .filter-select option:checked{background:#c2904d;color:#0e0f09;}
  .filter-btn{background:#c2904d;color:#0e0f09;border:none;border-radius:10px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .15s;}
  .filter-btn:hover{filter:brightness(1.08);}
  .filter-clear{font-size:13px;color:#7a6e5e;text-decoration:none;padding:9px 4px;transition:color .15s;}
  .filter-clear:hover{color:#c2904d;}
  @media(max-width:768px){.leads-page{padding:20px;}}
`;

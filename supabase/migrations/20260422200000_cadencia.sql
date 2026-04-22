-- ─── Cadência Flows ───────────────────────────────────────────────────
create table if not exists cadencia_flows (
  id          uuid    primary key default gen_random_uuid(),
  nome        text    not null,
  descricao   text,
  trigger_tipo text   not null default 'manual',
  -- 'manual' | 'form_submit' | 'tag_add' | 'lead_criado' | 'sdr' | 'import'
  trigger_config jsonb default '{}',
  status      text    not null default 'rascunho',
  -- 'rascunho' | 'ativo' | 'pausado'
  total_execucoes int default 0,
  criado_em   timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ─── Nodes (IDs vindos do React Flow) ────────────────────────────────
create table if not exists cadencia_nodes (
  id      text    primary key,          -- React Flow node id
  flow_id uuid    references cadencia_flows(id) on delete cascade,
  tipo    text    not null,
  -- 'inicio' | 'mensagem' | 'aguardar' | 'condicao' | 'tag' | 'agente_ia' | 'fim'
  label   text,
  config  jsonb   default '{}',
  pos_x   float   default 0,
  pos_y   float   default 0,
  criado_em timestamptz default now()
);

-- ─── Edges ───────────────────────────────────────────────────────────
create table if not exists cadencia_edges (
  id            text primary key,       -- React Flow edge id
  flow_id       uuid references cadencia_flows(id) on delete cascade,
  source_id     text not null,
  target_id     text not null,
  source_handle text,                   -- 'sim' | 'nao' para nó condição
  label         text,
  criado_em     timestamptz default now()
);

-- ─── Execuções (por lead) ────────────────────────────────────────────
create table if not exists cadencia_execucoes (
  id           uuid primary key default gen_random_uuid(),
  flow_id      uuid references cadencia_flows(id),
  lead_id      uuid references leads(id),
  node_atual_id text,
  status       text default 'ativo',   -- 'ativo' | 'concluido' | 'pausado' | 'erro'
  contexto     jsonb default '{}',     -- dados do lead + respostas do form
  iniciado_em  timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ─── Agendamentos (passos futuros) ───────────────────────────────────
create table if not exists cadencia_agendamentos (
  id           uuid primary key default gen_random_uuid(),
  execucao_id  uuid references cadencia_execucoes(id) on delete cascade,
  flow_id      uuid references cadencia_flows(id),
  lead_id      uuid references leads(id),
  node_id      text not null,
  agendado_para timestamptz not null,
  status       text default 'pendente', -- 'pendente' | 'processado' | 'erro'
  tentativas   int  default 0,
  erro         text,
  criado_em    timestamptz default now()
);

-- Índices
create index if not exists idx_cadencia_nodes_flow on cadencia_nodes(flow_id);
create index if not exists idx_cadencia_edges_flow on cadencia_edges(flow_id);
create index if not exists idx_cadencia_exec_flow  on cadencia_execucoes(flow_id);
create index if not exists idx_cadencia_exec_lead  on cadencia_execucoes(lead_id);
create index if not exists idx_cadencia_agend_status on cadencia_agendamentos(status, agendado_para);
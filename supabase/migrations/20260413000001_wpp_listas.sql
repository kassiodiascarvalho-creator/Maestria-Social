-- Listas de contatos para disparo WhatsApp
create table if not exists wpp_listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- Contatos de cada lista
create table if not exists wpp_contatos (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references wpp_listas(id) on delete cascade,
  nome text,
  telefone text not null,
  criado_em timestamptz not null default now()
);

create index if not exists wpp_contatos_lista_id_idx on wpp_contatos(lista_id);

-- Histórico de disparos
create table if not exists wpp_disparos (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid references wpp_listas(id) on delete set null,
  lista_nome text,
  tipo text not null, -- text | image | audio | video | document
  conteudo text,      -- texto ou URL da mídia
  caption text,
  filename text,
  total int not null default 0,
  enviados int not null default 0,
  falhas int not null default 0,
  criado_em timestamptz not null default now()
);

-- RLS: apenas service_role acessa (dashboard admin)
alter table wpp_listas enable row level security;
alter table wpp_contatos enable row level security;
alter table wpp_disparos enable row level security;

create policy "service_role_all_wpp_listas" on wpp_listas for all to service_role using (true) with check (true);
create policy "service_role_all_wpp_contatos" on wpp_contatos for all to service_role using (true) with check (true);
create policy "service_role_all_wpp_disparos" on wpp_disparos for all to service_role using (true) with check (true);

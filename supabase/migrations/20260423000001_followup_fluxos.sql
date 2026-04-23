-- Fluxos de follow-up: grupos nomeados de mensagens sequenciais
create table if not exists followup_fluxos (
  id                uuid primary key default gen_random_uuid(),
  agente_id         uuid references agentes(id) on delete cascade,
  nome              text not null,
  -- tipo: 'inatividade' (lead não responde), 'interacao' (lead respondeu), 'lembrete_reuniao', 'personalizado'
  tipo              text not null default 'inatividade',
  ativo             boolean not null default true,
  -- O que fazer quando o fluxo terminar
  ao_finalizar      text not null default 'parar', -- 'parar' | 'proximo_fluxo'
  fluxo_destino_id  uuid references followup_fluxos(id) on delete set null,
  -- Condição para parar o fluxo antecipadamente
  condicao_parada   text, -- 'agendamento' | null
  criado_em         timestamptz not null default now()
);

alter table followup_fluxos enable row level security;
create policy "service role full access followup_fluxos"
  on followup_fluxos for all using (true) with check (true);

-- Adicionar fluxo_id e horas_apos em followup_configs
alter table followup_configs
  add column if not exists fluxo_id   uuid references followup_fluxos(id) on delete cascade,
  add column if not exists horas_apos numeric; -- delay em horas após a mensagem anterior (ou entrada no fluxo)

-- Estado atual de cada lead em um fluxo sequencial
create table if not exists followup_lead_estado (
  lead_id          uuid primary key references leads(id) on delete cascade,
  fluxo_id         uuid not null references followup_fluxos(id) on delete cascade,
  proxima_ordem    int not null default 0,
  ultima_atividade timestamptz not null default now(), -- quando entrou no fluxo ou última msg foi enviada
  pausado          boolean not null default false
);

alter table followup_lead_estado enable row level security;
create policy "service role full access followup_lead_estado"
  on followup_lead_estado for all using (true) with check (true);

-- Flag em leads: criado via disparo e confirmado como enviado com sucesso
alter table leads
  add column if not exists via_disparo       boolean not null default false,
  add column if not exists disparo_confirmado boolean not null default false;

-- Índices
create index if not exists followup_fluxos_agente_idx on followup_fluxos(agente_id);
create index if not exists followup_configs_fluxo_idx on followup_configs(fluxo_id, ordem);
create index if not exists followup_lead_estado_fluxo_idx on followup_lead_estado(fluxo_id);

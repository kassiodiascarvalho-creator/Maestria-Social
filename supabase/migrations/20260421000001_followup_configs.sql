-- Follow-up configs: lembretes de reunião e reengajamento por inatividade
create table if not exists followup_configs (
  id          uuid primary key default gen_random_uuid(),
  agente_id   uuid references agentes(id) on delete cascade,
  nome        text not null,
  tipo        text not null check (tipo in ('lembrete_reuniao', 'reengajamento')),
  ativo       boolean not null default true,
  -- lembrete_reuniao: quantas horas antes da reunião enviar
  horas_antes numeric,
  -- reengajamento: quantas horas sem resposta do lead para disparar
  horas_sem_resposta numeric,
  mensagem    text not null,
  ordem       int not null default 0,
  criado_em   timestamptz not null default now()
);

alter table followup_configs enable row level security;

create policy "service role full access followup_configs"
  on followup_configs for all
  using (true)
  with check (true);

-- Tabela de controle: evita enviar o mesmo follow-up duas vezes para o mesmo lead
create table if not exists followup_enviados (
  id              uuid primary key default gen_random_uuid(),
  followup_id     uuid references followup_configs(id) on delete cascade,
  lead_id         uuid references leads(id) on delete cascade,
  -- Para lembretes: referência ao agendamento
  agendamento_id  uuid references agenda_agendamentos(id) on delete cascade,
  enviado_em      timestamptz not null default now(),
  unique (followup_id, lead_id, agendamento_id)
);

alter table followup_enviados enable row level security;

create policy "service role full access followup_enviados"
  on followup_enviados for all
  using (true)
  with check (true);

-- Índices
create index if not exists followup_configs_agente_idx on followup_configs(agente_id);
create index if not exists followup_configs_tipo_idx on followup_configs(tipo, ativo);
create index if not exists followup_enviados_lead_idx on followup_enviados(lead_id, followup_id);
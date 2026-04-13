-- Marca lista como lista de leads (sincronizada automaticamente)
alter table wpp_listas add column if not exists is_leads boolean default false;

-- Rastreia última mensagem recebida do contato (janela 24h)
alter table wpp_contatos add column if not exists ultima_msg_user timestamptz default null;

-- Referência ao lead (para filtros por pilar, nível, status)
alter table wpp_contatos add column if not exists lead_id uuid default null references leads(id) on delete set null;

-- Index para busca rápida por lead_id
create index if not exists idx_wpp_contatos_lead_id on wpp_contatos(lead_id);

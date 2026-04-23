-- Adiciona: quando o lead responder em qualquer momento, vai para qual fluxo?
alter table followup_fluxos
  add column if not exists fluxo_ao_responder_id uuid references followup_fluxos(id) on delete set null;

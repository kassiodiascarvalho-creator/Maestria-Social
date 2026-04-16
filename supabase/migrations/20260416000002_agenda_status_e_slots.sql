-- Expandir status do agendamento para incluir iniciado e no_show
ALTER TABLE agenda_agendamentos DROP CONSTRAINT IF EXISTS agenda_agendamentos_status_check;
ALTER TABLE agenda_agendamentos
  ADD CONSTRAINT agenda_agendamentos_status_check
  CHECK (status IN ('confirmado', 'iniciado', 'realizado', 'cancelado', 'no_show'));

-- Vincula uma pessoa da agenda a um agente SDR específico
-- Quando o agente receber uma resposta de lead, busca o slug desta pessoa
-- e monta o link de agendamento automaticamente
ALTER TABLE agenda_pessoas ADD COLUMN IF NOT EXISTS agente_id UUID REFERENCES agentes(id) ON DELETE SET NULL;

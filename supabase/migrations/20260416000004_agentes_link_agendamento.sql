-- Adiciona link de agendamento específico por agente
-- Cada agente pode ter seu próprio link para a página de agendamento do mentor correspondente
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS link_agendamento TEXT;

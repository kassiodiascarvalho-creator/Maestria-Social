-- ── Fix 1: agenda_campos ─────────────────────────────────────────────────────
-- Renomear 'label' para 'nome' para consistência com o código
ALTER TABLE agenda_campos RENAME COLUMN label TO nome;

-- Adicionar coluna 'fixo' para marcar campos que não podem ser removidos
ALTER TABLE agenda_campos ADD COLUMN IF NOT EXISTS fixo BOOLEAN DEFAULT false;

-- Marcar campos padrão como fixos
UPDATE agenda_campos SET fixo = true
WHERE LOWER(nome) IN ('nome completo', 'e-mail', 'whatsapp');

-- Expandir constraint de tipo para incluir variantes
ALTER TABLE agenda_campos DROP CONSTRAINT IF EXISTS agenda_campos_tipo_check;
ALTER TABLE agenda_campos
  ADD CONSTRAINT agenda_campos_tipo_check
  CHECK (tipo IN ('text','email','phone','tel','textarea','select','number','date'));

-- Atualizar tipo 'phone' para 'tel' (padronização)
UPDATE agenda_campos SET tipo = 'tel' WHERE tipo = 'phone';

-- ── Fix 2: agenda_agendamentos ────────────────────────────────────────────────
-- Adicionar colunas que faltavam
ALTER TABLE agenda_agendamentos
  ADD COLUMN IF NOT EXISTS horario_fim TIME,
  ADD COLUMN IF NOT EXISTS campos_preenchidos JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS google_event_link TEXT;

-- Tornar nome_lead e email_lead opcionais (dados virão de campos_preenchidos)
ALTER TABLE agenda_agendamentos
  ALTER COLUMN nome_lead DROP NOT NULL,
  ALTER COLUMN email_lead DROP NOT NULL;

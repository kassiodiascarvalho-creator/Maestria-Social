ALTER TABLE agentes ADD COLUMN IF NOT EXISTS debounce_segundos INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN agentes.debounce_segundos IS 'Segundos de espera antes de responder (0 = resposta imediata)';

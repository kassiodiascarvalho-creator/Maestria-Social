-- Adiciona utm_term, utm_content e campo concluido corrigido
ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS utm_term    text,
  ADD COLUMN IF NOT EXISTS utm_content text;
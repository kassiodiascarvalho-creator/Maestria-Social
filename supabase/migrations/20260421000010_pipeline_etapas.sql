-- Tabela de etapas do pipeline (substituindo etapas hardcoded)
CREATE TABLE IF NOT EXISTS pipeline_etapas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text        NOT NULL UNIQUE,
  label      text        NOT NULL,
  emoji      text,
  icone_url  text,        -- URL de ícone SVG/PNG no Storage
  cor        text        NOT NULL DEFAULT '#7ab0e0',
  ordem      int         NOT NULL DEFAULT 0,
  is_final   boolean     NOT NULL DEFAULT false,  -- etapas finais (convertido/perdido)
  criado_em  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pipeline_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access pipeline_etapas"
  ON pipeline_etapas FOR ALL
  USING (true) WITH CHECK (true);

-- Seed com as 7 etapas atuais
INSERT INTO pipeline_etapas (slug, label, emoji, cor, ordem, is_final) VALUES
  ('novo',        'Novo',        '🌱', '#7ab0e0', 0, false),
  ('em_contato',  'Em Contato',  '💬', '#6acca0', 1, false),
  ('qualificado', 'Qualificado', '⚡', '#c2904d', 2, false),
  ('proposta',    'Proposta',    '🎯', '#a07ae0', 3, false),
  ('agendado',    'Agendado',    '📅', '#7ae0d4', 4, false),
  ('convertido',  'Convertido',  '✅', '#f0c040', 5, true),
  ('perdido',     'Perdido',     '❌', '#e07070', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- Remove o CHECK constraint fixo da coluna pipeline_etapa nos leads
-- (agora qualquer texto é válido — validação fica no app)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_pipeline_etapa_check;

-- Índice para ordenação
CREATE INDEX IF NOT EXISTS pipeline_etapas_ordem_idx ON pipeline_etapas(ordem);

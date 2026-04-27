-- ── Score de engajamento de e-mail por lead ──────────────────────────
-- Separado do qs_total (score do quiz) para não misturar métricas

ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_email int NOT NULL DEFAULT 0;

COMMENT ON COLUMN leads.score_email IS
  'Pontuação de engajamento via e-mail: +5 abertura, +10 clique. Usado no lead scoring SE→ENTÃO.';

-- ── Índice para segmentação por score ────────────────────────────────
CREATE INDEX IF NOT EXISTS leads_score_email_idx ON leads (score_email DESC);

-- ── Estende cadencia_nodes para suportar nó de e-mail ─────────────────
-- Remove a constraint existente e recria incluindo 'email'
ALTER TABLE cadencia_nodes DROP CONSTRAINT IF EXISTS cadencia_nodes_tipo_check;

ALTER TABLE cadencia_nodes ADD CONSTRAINT cadencia_nodes_tipo_check
  CHECK (tipo IN (
    'inicio', 'mensagem', 'email', 'aguardar',
    'condicao', 'tag', 'agente_ia', 'webhook', 'fim'
  ));

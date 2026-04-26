-- ════════════════════════════════════════════════
-- TABELA DE VENDAS — Fase 3 (Hotmart / Kiwify)
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vendas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  plataforma      text NOT NULL CHECK (plataforma IN ('hotmart','kiwify','eduzz','monetizze','manual')),
  produto_nome    text,
  produto_id      text,
  valor           numeric(10,2) DEFAULT 0,
  moeda           text DEFAULT 'BRL',
  status          text DEFAULT 'aprovado'
    CHECK (status IN ('aprovado','cancelado','reembolsado','pendente','chargeback')),
  transaction_id  text UNIQUE,
  comprador_email text,
  comprador_nome  text,
  comprador_fone  text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  dados_raw       jsonb,
  criado_em       timestamptz DEFAULT now()
);

CREATE INDEX ON vendas(lead_id);
CREATE INDEX ON vendas(plataforma);
CREATE INDEX ON vendas(status);
CREATE INDEX ON vendas(criado_em DESC);
CREATE INDEX ON vendas(comprador_email);

ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON vendas FOR ALL USING (true);

-- View para receita por período
CREATE OR REPLACE VIEW receita_resumo AS
SELECT
  plataforma,
  status,
  COUNT(*) as total_vendas,
  COALESCE(SUM(valor), 0) as receita_total,
  COALESCE(AVG(valor), 0) as ticket_medio,
  DATE_TRUNC('day', criado_em) as dia
FROM vendas
GROUP BY plataforma, status, DATE_TRUNC('day', criado_em);

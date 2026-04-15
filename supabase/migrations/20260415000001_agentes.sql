-- Tabela de agentes SDR (múltiplos agentes por conta)
CREATE TABLE IF NOT EXISTS agentes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT NOT NULL,
  descricao   TEXT DEFAULT '',
  prompt      TEXT NOT NULL DEFAULT '',
  temperatura NUMERIC(3,2) DEFAULT 0.2 CHECK (temperatura >= 0 AND temperatura <= 1),
  modelo      TEXT DEFAULT 'gpt-4.1-mini',
  ativo       BOOLEAN DEFAULT true,
  canais      JSONB DEFAULT '[]'::jsonb,   -- [{"provider":"meta|baileys","id":"..."}]
  criado_em   TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_agentes_atualizado_em
  BEFORE UPDATE ON agentes
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

ALTER TABLE agentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_agentes"
  ON agentes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

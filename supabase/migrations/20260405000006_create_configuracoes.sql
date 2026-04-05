-- Tabela de configurações do sistema (credenciais de API, etc.)
CREATE TABLE IF NOT EXISTS configuracoes (
  chave   TEXT PRIMARY KEY,
  valor   TEXT NOT NULL,
  criado_em  TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Trigger para atualizar atualizado_em
CREATE TRIGGER set_configuracoes_atualizado_em
  BEFORE UPDATE ON configuracoes
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- RLS: apenas service_role acessa
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_configuracoes"
  ON configuracoes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

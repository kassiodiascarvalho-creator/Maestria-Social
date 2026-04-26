-- Page builder: tabela de páginas públicas editáveis
CREATE TABLE IF NOT EXISTS paginas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  descricao TEXT,
  conteudo JSONB NOT NULL DEFAULT '[]',
  configuracoes JSONB NOT NULL DEFAULT '{}',
  publicada BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paginas_slug_idx ON paginas(slug);
CREATE INDEX IF NOT EXISTS paginas_publicada_idx ON paginas(publicada);

ALTER TABLE paginas ENABLE ROW LEVEL SECURITY;

-- Leitura pública para páginas publicadas
CREATE POLICY "paginas_public_select" ON paginas
  FOR SELECT USING (publicada = true);

-- Admin (service role) tem acesso total
CREATE POLICY "paginas_admin_all" ON paginas
  FOR ALL USING (true);

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION update_paginas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER paginas_updated_at
  BEFORE UPDATE ON paginas
  FOR EACH ROW EXECUTE FUNCTION update_paginas_updated_at();
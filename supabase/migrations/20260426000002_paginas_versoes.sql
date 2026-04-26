-- Histórico de versões do page builder
CREATE TABLE IF NOT EXISTS paginas_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagina_id UUID NOT NULL REFERENCES paginas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  conteudo JSONB NOT NULL DEFAULT '[]',
  configuracoes JSONB NOT NULL DEFAULT '{}',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paginas_versoes_pagina_idx ON paginas_versoes(pagina_id, criado_em DESC);

ALTER TABLE paginas_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paginas_versoes_admin_all" ON paginas_versoes FOR ALL USING (true);

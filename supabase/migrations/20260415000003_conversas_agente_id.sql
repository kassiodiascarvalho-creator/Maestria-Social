-- Adiciona agente_id em conversas para separar histórico por agente.
-- Permite que agentes diferentes que atendem o mesmo lead tenham contextos independentes.
-- NULL = mensagem sem agente (legado, disparo manual, mensagem inicial sem agente configurado).

ALTER TABLE conversas
  ADD COLUMN IF NOT EXISTS agente_id UUID REFERENCES agentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversas_agente_id_idx ON conversas(agente_id);

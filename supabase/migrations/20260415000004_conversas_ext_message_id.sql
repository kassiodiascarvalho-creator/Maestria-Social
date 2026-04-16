-- Deduplicação de webhooks: armazena o ID externo da mensagem (Meta/Baileys).
-- Índice UNIQUE garante que o mesmo evento entregue duas vezes não gere resposta duplicada.

ALTER TABLE conversas ADD COLUMN IF NOT EXISTS ext_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS conversas_ext_message_id_unique
  ON conversas(ext_message_id)
  WHERE ext_message_id IS NOT NULL;

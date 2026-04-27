-- ── Inbox de E-mail: Conversas e Mensagens ──────────────────────
-- Cada campanha enviada cria uma conversa por destinatário.
-- Respostas do lead chegam via webhook de inbound e viram mensagens.

CREATE TABLE IF NOT EXISTS conversas_email (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            uuid REFERENCES leads(id) ON DELETE SET NULL,
  campanha_id        uuid REFERENCES email_campanhas(id) ON DELETE SET NULL,
  email_lead         text NOT NULL,
  nome_lead          text,
  assunto            text NOT NULL,
  status             text DEFAULT 'aguardando'
    CHECK (status IN ('aguardando', 'respondido', 'fechado')),
  total_mensagens    int DEFAULT 1,
  nao_lidas          int DEFAULT 0,
  ultima_mensagem_em timestamptz DEFAULT now(),
  criado_em          timestamptz DEFAULT now(),
  UNIQUE (campanha_id, email_lead)
);

CREATE TABLE IF NOT EXISTS mensagens_email (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id       uuid NOT NULL REFERENCES conversas_email(id) ON DELETE CASCADE,
  direcao           text NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  de                text NOT NULL,
  corpo_html        text,
  corpo_texto       text,
  lida              boolean DEFAULT true,
  resend_message_id text,
  criado_em         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversas_email_lead    ON conversas_email(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversas_email_status  ON conversas_email(status);
CREATE INDEX IF NOT EXISTS idx_conversas_email_ultima  ON conversas_email(ultima_mensagem_em DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_email_conversa ON mensagens_email(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_email_resend   ON mensagens_email(resend_message_id)
  WHERE resend_message_id IS NOT NULL;

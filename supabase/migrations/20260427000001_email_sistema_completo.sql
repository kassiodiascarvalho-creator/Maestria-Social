-- ════════════════════════════════════════════════
-- SISTEMA DE EMAIL MARKETING PROFISSIONAL
-- ════════════════════════════════════════════════

-- Listas de contatos
CREATE TABLE IF NOT EXISTS email_listas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  descricao   text,
  tags        text[] DEFAULT '{}',
  total_contatos int DEFAULT 0,
  criado_em   timestamptz DEFAULT now()
);

-- Contatos dentro de uma lista
CREATE TABLE IF NOT EXISTS email_lista_contatos (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id  uuid NOT NULL REFERENCES email_listas(id) ON DELETE CASCADE,
  lead_id   uuid REFERENCES leads(id) ON DELETE SET NULL,
  email     text NOT NULL,
  nome      text,
  tags      text[] DEFAULT '{}',
  status    text DEFAULT 'ativo' CHECK (status IN ('ativo','descadastrado','bounced','spam')),
  origem    text DEFAULT 'manual',
  criado_em timestamptz DEFAULT now(),
  UNIQUE(lista_id, email)
);

-- Campanhas (envio para uma lista)
CREATE TABLE IF NOT EXISTS email_campanhas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL,
  assunto_a         text NOT NULL,
  assunto_b         text,         -- A/B test
  pre_header        text,
  remetente_nome    text NOT NULL DEFAULT 'Maestria Social',
  remetente_email   text NOT NULL,
  lista_id          uuid REFERENCES email_listas(id),
  template_id       uuid,         -- referência a email_templates existente
  html              text,
  texto             text,
  status            text DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','agendado','enviando','enviado','pausado','cancelado')),
  -- A/B test
  ab_ativo          boolean DEFAULT false,
  ab_percentual     int DEFAULT 50,   -- % para variante B
  ab_vencedor       text,             -- 'a' | 'b'
  -- Stats denormalizados para performance
  total_enviados    int DEFAULT 0,
  total_entregues   int DEFAULT 0,
  total_abertos     int DEFAULT 0,
  total_cliques     int DEFAULT 0,
  total_bounced     int DEFAULT 0,
  total_spam        int DEFAULT 0,
  -- Timestamps
  agendado_para     timestamptz,
  iniciado_em       timestamptz,
  concluido_em      timestamptz,
  criado_em         timestamptz DEFAULT now()
);

-- Log individual por destinatário
CREATE TABLE IF NOT EXISTS email_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id  uuid NOT NULL REFERENCES email_campanhas(id) ON DELETE CASCADE,
  contato_id   uuid REFERENCES email_lista_contatos(id) ON DELETE SET NULL,
  lead_id      uuid REFERENCES leads(id) ON DELETE SET NULL,
  email        text NOT NULL,
  nome         text,
  variante     text DEFAULT 'a',   -- 'a' | 'b' para A/B
  resend_id    text,               -- ID do Resend para correlacionar webhooks
  status       text DEFAULT 'enviando'
    CHECK (status IN ('enviando','entregue','aberto','clicado','bounced','spam','erro')),
  enviado_em   timestamptz DEFAULT now(),
  entregue_em  timestamptz,
  aberto_em    timestamptz,
  clicado_em   timestamptz,
  bounced_em   timestamptz,
  total_aberturas int DEFAULT 0,
  total_cliques   int DEFAULT 0,
  erro_msg     text
);

-- Eventos de tracking (open, click, bounce...)
CREATE TABLE IF NOT EXISTS email_eventos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id     uuid NOT NULL REFERENCES email_logs(id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN ('aberto','clicado','bounced','spam','entregue','erro')),
  url        text,
  ip         text,
  user_agent text,
  criado_em  timestamptz DEFAULT now()
);

-- Automações (se abriu e não clicou → reenviar etc.)
CREATE TABLE IF NOT EXISTS email_automacoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL,
  ativo        boolean DEFAULT true,
  gatilho      text NOT NULL CHECK (gatilho IN ('abriu_nao_clicou','clicou_nao_comprou','ignorou_3','comprou')),
  delay_horas  int DEFAULT 24,
  campanha_origem_id uuid REFERENCES email_campanhas(id) ON DELETE CASCADE,
  acao_template_id   uuid,   -- template para reenviar
  acao_assunto       text,
  criado_em    timestamptz DEFAULT now()
);

-- ── Índices ─────────────────────────────────────
CREATE INDEX ON email_lista_contatos(lista_id);
CREATE INDEX ON email_lista_contatos(email);
CREATE INDEX ON email_lista_contatos(lead_id);
CREATE INDEX ON email_lista_contatos(status);
CREATE INDEX ON email_logs(campanha_id);
CREATE INDEX ON email_logs(resend_id);
CREATE INDEX ON email_logs(email);
CREATE INDEX ON email_logs(status);
CREATE INDEX ON email_eventos(log_id);
CREATE INDEX ON email_eventos(tipo);
CREATE INDEX ON email_eventos(criado_em);

-- ── RLS ─────────────────────────────────────────
ALTER TABLE email_listas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_lista_contatos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campanhas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_eventos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automacoes        ENABLE ROW LEVEL SECURITY;

-- Apenas service role (admin) acessa
CREATE POLICY "admin_all" ON email_listas            FOR ALL USING (true);
CREATE POLICY "admin_all" ON email_lista_contatos    FOR ALL USING (true);
CREATE POLICY "admin_all" ON email_campanhas         FOR ALL USING (true);
CREATE POLICY "admin_all" ON email_logs              FOR ALL USING (true);
CREATE POLICY "admin_all" ON email_eventos           FOR ALL USING (true);
CREATE POLICY "admin_all" ON email_automacoes        FOR ALL USING (true);

-- ── Função: atualiza total_contatos ─────────────
CREATE OR REPLACE FUNCTION atualizar_total_contatos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE email_listas
  SET total_contatos = (
    SELECT COUNT(*) FROM email_lista_contatos
    WHERE lista_id = COALESCE(NEW.lista_id, OLD.lista_id)
    AND status = 'ativo'
  )
  WHERE id = COALESCE(NEW.lista_id, OLD.lista_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_total_contatos
AFTER INSERT OR UPDATE OR DELETE ON email_lista_contatos
FOR EACH ROW EXECUTE FUNCTION atualizar_total_contatos();

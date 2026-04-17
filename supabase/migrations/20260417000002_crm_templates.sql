-- Templates de mensagem para follow-up no CRM
CREATE TABLE IF NOT EXISTS crm_templates (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL,
  conteudo  text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_crm_templates"
  ON crm_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);

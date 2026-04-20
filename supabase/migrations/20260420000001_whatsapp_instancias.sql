-- Gerenciamento de múltiplos números WhatsApp (Meta API + Baileys)
CREATE TABLE IF NOT EXISTS whatsapp_instancias (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo             text        NOT NULL CHECK (tipo IN ('meta', 'baileys')),
  label            text        NOT NULL,
  phone            text,                          -- número formatado para exibição ex: +55 11 99999-9999
  -- campos Meta API
  meta_phone_number_id  text,
  meta_access_token     text,
  meta_waba_id          text,
  meta_template_name    text,
  meta_template_language text DEFAULT 'pt_BR',
  -- campos Baileys
  baileys_instance_id   text,
  -- config
  principal        boolean     NOT NULL DEFAULT false,
  ativo            boolean     NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

-- Apenas uma instância pode ser principal
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instancias_principal_idx
  ON whatsapp_instancias (principal) WHERE principal = true;

COMMENT ON TABLE whatsapp_instancias IS 'Múltiplos números WhatsApp configurados (Meta API ou Baileys)';

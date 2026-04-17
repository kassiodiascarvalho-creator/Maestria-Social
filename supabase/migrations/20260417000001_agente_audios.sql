-- Tabela de áudios por agente
CREATE TABLE IF NOT EXISTS agente_audios (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agente_id   uuid NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  nome        text NOT NULL,           -- identificador usado no marcador [[AUDIO:nome]]
  url         text NOT NULL,           -- URL pública no Supabase Storage
  tamanho     bigint,                  -- bytes
  mimetype    text DEFAULT 'audio/mpeg',
  criado_em   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agente_audios_agente_idx ON agente_audios (agente_id);

-- Bucket público para áudios dos agentes (executar via Supabase Dashboard se não existir)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('agente-audios', 'agente-audios', true)
-- ON CONFLICT (id) DO NOTHING;

-- Migration 004: Tabelas de integrações
-- api_keys: chaves de API próprias do usuário para integrações externas
-- webhook_configs: endpoints de saída configuráveis por evento

-- ─── API KEYS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL,
  -- chave armazenada como hash SHA-256 — nunca em plain text
  chave_hash       text NOT NULL UNIQUE,
  -- prefixo visível para identificação (ex: "ms_live_xxxx")
  chave_prefixo    text NOT NULL,
  ativa            boolean NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_chave_hash_idx ON public.api_keys (chave_hash);
CREATE INDEX IF NOT EXISTS api_keys_ativa_idx ON public.api_keys (ativa) WHERE ativa = true;

COMMENT ON TABLE public.api_keys IS 'Chaves de API geradas para integrações externas com a plataforma';
COMMENT ON COLUMN public.api_keys.chave_hash IS 'Hash SHA-256 da chave — nunca armazenar plain text';
COMMENT ON COLUMN public.api_keys.chave_prefixo IS 'Prefixo visível para identificação: ms_live_xxxx...';

-- ─── WEBHOOK CONFIGS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento           text NOT NULL CHECK (evento IN ('novo_lead', 'lead_qualificado', 'mensagem_recebida', 'status_atualizado')),
  url              text NOT NULL,
  secret           text,            -- secret para assinar o payload (HMAC)
  ativo            boolean NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_configs_evento_idx ON public.webhook_configs (evento);
CREATE INDEX IF NOT EXISTS webhook_configs_ativo_idx ON public.webhook_configs (ativo) WHERE ativo = true;

COMMENT ON TABLE public.webhook_configs IS 'Endpoints de saída configurados para disparar em eventos da plataforma';
COMMENT ON COLUMN public.webhook_configs.evento IS 'Evento que dispara o webhook: novo_lead | lead_qualificado | mensagem_recebida | status_atualizado';
COMMENT ON COLUMN public.webhook_configs.secret IS 'Secret HMAC para validar autenticidade do payload no receptor';

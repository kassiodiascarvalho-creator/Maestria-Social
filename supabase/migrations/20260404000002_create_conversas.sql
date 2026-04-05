-- Migration 002: Tabela conversas
-- Histórico completo de mensagens entre lead e agente SDR

CREATE TABLE IF NOT EXISTS public.conversas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  mensagem         text NOT NULL,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar histórico de um lead ordenado por data
CREATE INDEX IF NOT EXISTS conversas_lead_id_criado_em_idx ON public.conversas (lead_id, criado_em ASC);

COMMENT ON TABLE public.conversas IS 'Histórico de mensagens WhatsApp entre lead e agente SDR';
COMMENT ON COLUMN public.conversas.role IS 'user = mensagem do lead | assistant = resposta do agente IA';

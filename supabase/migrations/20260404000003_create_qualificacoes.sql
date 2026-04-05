-- Migration 003: Tabela qualificacoes
-- Informações extraídas pelo agente SDR durante a conversa

CREATE TABLE IF NOT EXISTS public.qualificacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campo            text NOT NULL CHECK (campo IN ('maior_dor', 'contexto', 'interesse', 'objecao', 'objetivo', 'urgencia', 'orcamento', 'outro')),
  valor            text NOT NULL,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar qualificações de um lead
CREATE INDEX IF NOT EXISTS qualificacoes_lead_id_idx ON public.qualificacoes (lead_id);
-- Índice para buscar por campo específico
CREATE INDEX IF NOT EXISTS qualificacoes_campo_idx ON public.qualificacoes (campo);

COMMENT ON TABLE public.qualificacoes IS 'Informações extraídas pelo agente SDR via IA durante a conversa';
COMMENT ON COLUMN public.qualificacoes.campo IS 'Tipo de informação: maior_dor | contexto | interesse | objecao | objetivo | urgencia | orcamento | outro';
COMMENT ON COLUMN public.qualificacoes.valor IS 'Valor extraído pela IA em linguagem natural';

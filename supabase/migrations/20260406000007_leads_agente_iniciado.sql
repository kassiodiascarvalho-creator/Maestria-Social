-- Migration 007: Adiciona flag agente_iniciado à tabela leads
-- Evita enviar mensagem inicial duplicada se o quiz for refeito

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS agente_iniciado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.agente_iniciado IS 'Indica se o agente já enviou a mensagem inicial para este lead';

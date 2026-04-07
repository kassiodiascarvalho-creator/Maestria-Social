-- Adicionar colunas faltantes na tabela leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS instagram    text,
  ADD COLUMN IF NOT EXISTS profissao    text,
  ADD COLUMN IF NOT EXISTS renda_mensal text;

COMMENT ON COLUMN public.leads.instagram    IS 'Usuário do Instagram informado na captura';
COMMENT ON COLUMN public.leads.profissao    IS 'Profissão informada na captura';
COMMENT ON COLUMN public.leads.renda_mensal IS 'Faixa de renda mensal informada na captura';

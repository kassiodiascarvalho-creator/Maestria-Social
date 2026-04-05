-- Migration 001: Tabela leads
-- Armazena todos os leads captados pela plataforma

CREATE TABLE IF NOT EXISTS public.leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL,
  email            text NOT NULL,
  whatsapp         text NOT NULL,
  qs_total         integer,
  qs_percentual    integer,
  scores           jsonb,           -- { "A": 32, "B": 28, "C": 35, "D": 22, "E": 30 }
  pilar_fraco      text,
  nivel_qs         text CHECK (nivel_qs IN ('Negligente', 'Iniciante', 'Intermediário', 'Avançado', 'Mestre')),
  status_lead      text NOT NULL DEFAULT 'frio' CHECK (status_lead IN ('frio', 'morno', 'quente')),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);

-- Índice único por email para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_idx ON public.leads (email);
CREATE UNIQUE INDEX IF NOT EXISTS leads_whatsapp_idx ON public.leads (whatsapp);

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_atualizado_em
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- Comentários
COMMENT ON TABLE public.leads IS 'Leads captados via página de entrada e quiz QS';
COMMENT ON COLUMN public.leads.scores IS 'JSON com score por pilar: { A, B, C, D, E } — max 50 cada';
COMMENT ON COLUMN public.leads.pilar_fraco IS 'Pilar com menor score — usado pelo agente SDR';
COMMENT ON COLUMN public.leads.nivel_qs IS 'Nível de maturidade social calculado pelo quiz';
COMMENT ON COLUMN public.leads.status_lead IS 'Temperatura do lead: frio | morno | quente';

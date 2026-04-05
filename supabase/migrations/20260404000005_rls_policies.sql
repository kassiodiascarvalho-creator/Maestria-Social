-- Migration 005: Row Level Security (RLS) em todas as tabelas
-- Estratégia: tabelas públicas bloqueadas por padrão, acesso apenas via service_role
-- Dashboard usa service_role server-side — sem acesso direto do browser

-- ─── HABILITAR RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

-- ─── LEADS ───────────────────────────────────────────────────────────────────
-- Inserção pública permitida (captura de leads via landing page)
CREATE POLICY "leads_insert_public"
  ON public.leads FOR INSERT
  TO anon
  WITH CHECK (true);

-- Leitura e escrita apenas via service_role (dashboard server-side)
CREATE POLICY "leads_all_service"
  ON public.leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── CONVERSAS ───────────────────────────────────────────────────────────────
-- Apenas service_role (agente SDR + dashboard)
CREATE POLICY "conversas_all_service"
  ON public.conversas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── QUALIFICAÇÕES ───────────────────────────────────────────────────────────
-- Apenas service_role (agente SDR + dashboard)
CREATE POLICY "qualificacoes_all_service"
  ON public.qualificacoes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── API KEYS ────────────────────────────────────────────────────────────────
-- Apenas service_role (painel de integrações)
CREATE POLICY "api_keys_all_service"
  ON public.api_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── WEBHOOK CONFIGS ─────────────────────────────────────────────────────────
-- Apenas service_role (painel de integrações)
CREATE POLICY "webhook_configs_all_service"
  ON public.webhook_configs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 🔧 REGISTRO DO WEBHOOK WHATSAPP
-- Execute este script no Supabase SQL Editor para registrar o endpoint
-- ═════════════════════════════════════════════════════════════════════════════

-- 1️⃣ Registrar o webhook para diferentes eventos
INSERT INTO public.webhook_configs (evento, url, secret, ativo)
VALUES 
  (
    'mensagem_recebida', 
    'https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook', 
    'seu-secret-aqui-123',
    true
  ),
  (
    'lead_qualificado', 
    'https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook', 
    'seu-secret-aqui-123',
    true
  ),
  (
    'status_atualizado',
    'https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook',
    'seu-secret-aqui-123',
    true
  ),
  (
    'novo_lead',
    'https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook',
    'seu-secret-aqui-123',
    true
  )
ON CONFLICT DO NOTHING;

-- 2️⃣ Verificar se foi inserido corretamente
SELECT 
  id,
  evento,
  url,
  ativo,
  criado_em
FROM public.webhook_configs
WHERE url LIKE '%whatsapp-webhook%'
ORDER BY criado_em DESC;

-- ═════════════════════════════════════════════════════════════════════════════
-- 📝 VERIFICAÇÃO DE CONFIGURAÇÕES NECESSÁRIAS
-- ═════════════════════════════════════════════════════════════════════════════

-- Verificar se META_ACCESS_TOKEN está configurado
SELECT 'META_ACCESS_TOKEN' as chave, valor FROM public.configuracoes 
WHERE chave = 'META_ACCESS_TOKEN'
UNION ALL
-- Verificar se META_PHONE_NUMBER_ID está configurado
SELECT 'META_PHONE_NUMBER_ID' as chave, valor FROM public.configuracoes 
WHERE chave = 'META_PHONE_NUMBER_ID';

-- ═════════════════════════════════════════════════════════════════════════════
-- 🔍 DEBUG: Listar todos os webhooks ativos
-- ═════════════════════════════════════════════════════════════════════════════
SELECT 
  id,
  evento,
  url,
  SUBSTRING(secret, 1, 10) || '...' as secret_preview,
  ativo,
  criado_em
FROM public.webhook_configs
WHERE ativo = true
ORDER BY evento;

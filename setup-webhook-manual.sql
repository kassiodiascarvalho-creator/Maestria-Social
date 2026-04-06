-- ═════════════════════════════════════════════════════════════════════════════
-- 🔧 SETUP WEBHOOK WHATSAPP — EXECUTAR ISTO NO SUPABASE SQL EDITOR
-- ═════════════════════════════════════════════════════════════════════════════

-- ✅ PASSO 1: Registrar o webhook para diferentes eventos
INSERT INTO public.webhook_configs (evento, url, secret, ativo)
VALUES 
  ('mensagem_recebida', 'https://dhudmbbgdyxdxypixyis.supabase.co/functions/v1/whatsapp-webhook', 'seu-secret-aqui-123', true),
  ('lead_qualificado', 'https://dhudmbbgdyxdxypixyis.supabase.co/functions/v1/whatsapp-webhook', 'seu-secret-aqui-123', true),
  ('status_atualizado', 'https://dhudmbbgdyxdxypixyis.supabase.co/functions/v1/whatsapp-webhook', 'seu-secret-aqui-123', true),
  ('novo_lead', 'https://dhudmbbgdyxdxypixyis.supabase.co/functions/v1/whatsapp-webhook', 'seu-secret-aqui-123', true)
ON CONFLICT DO NOTHING;

-- ✅ PASSO 2: Verificar se foi inserido
SELECT COUNT(*) as webhooks_registrados
FROM public.webhook_configs
WHERE url LIKE '%whatsapp-webhook%';

-- ✅ PASSO 3: Listar todos os webhooks
SELECT 
  id,
  evento,
  url,
  SUBSTRING(secret, 1, 15) || '...' as secret_preview,
  ativo,
  criado_em
FROM public.webhook_configs
WHERE url LIKE '%whatsapp-webhook%'
ORDER BY evento;

-- ✅ PASSO 4: Verificar credenciais Meta
SELECT 
  chave,
  CASE 
    WHEN valor IS NOT NULL THEN SUBSTRING(valor, 1, 10) || '...'
    ELSE 'NÃO CONFIGURADO'
  END as valor_preview
FROM public.configuracoes
WHERE chave IN ('META_ACCESS_TOKEN', 'META_PHONE_NUMBER_ID')
ORDER BY chave;

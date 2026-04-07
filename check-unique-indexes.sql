-- Verificar se os índices únicos existem
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'leads' 
AND indexname IN ('leads_email_idx', 'leads_whatsapp_idx', 'leads_email_key', 'leads_whatsapp_key');

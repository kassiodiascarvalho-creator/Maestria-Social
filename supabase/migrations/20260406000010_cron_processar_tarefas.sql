-- Supabase Cron: chama o worker /api/cron/processar-tarefas a cada minuto
-- Requer: pg_cron + pg_net
-- Variáveis injetadas via Vault ou substituídas manualmente após deploy.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job antigo se existir
DO $$
BEGIN
  PERFORM cron.unschedule('processar-tarefas-agendadas');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- IMPORTANTE: substitua os placeholders abaixo pelos valores reais via psql
-- após aplicar a migration:
--
--   SELECT cron.schedule(
--     'processar-tarefas-agendadas',
--     '* * * * *',
--     $$
--     SELECT net.http_post(
--       url := 'https://maestria-social.vercel.app/api/cron/processar-tarefas',
--       headers := jsonb_build_object(
--         'Content-Type','application/json',
--         'Authorization','Bearer SEU_CRON_SECRET'
--       )
--     );
--     $$
--   );
--
-- Esta migration apenas habilita as extensões; o agendamento é feito 1 vez
-- via SQL editor do Supabase para evitar versionar o secret no repositório.

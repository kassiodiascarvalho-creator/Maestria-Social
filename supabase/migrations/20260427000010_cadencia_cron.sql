-- ── Cron do processador de cadência via Supabase pg_cron ─────────────
-- Substitui o Vercel Cron (indisponível no plano free)
-- Executa a cada 5 minutos e chama /api/cron/processar-cadencia

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job anterior se existir (idempotente)
SELECT cron.unschedule('processar-cadencia-5min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-cadencia-5min');

-- Agenda: a cada 5 minutos
-- Requer configuração prévia (rode uma vez no SQL Editor do Supabase):
--   ALTER DATABASE postgres SET app.api_url = 'https://maestriasocial.vercel.app';
--   ALTER DATABASE postgres SET app.cron_secret = 'seu-valor-do-CRON_SECRET';
SELECT cron.schedule(
  'processar-cadencia-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url    := current_setting('app.api_url', true) || '/api/cron/processar-cadencia',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    )
  );
  $$
);

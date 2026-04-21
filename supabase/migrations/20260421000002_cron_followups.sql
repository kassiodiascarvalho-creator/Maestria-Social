-- Agenda o cron job de follow-ups a cada minuto
DO $$
BEGIN
  PERFORM cron.unschedule('processar-followups');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'processar-followups',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://maestria-social.vercel.app/api/cron/followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer e2be246437c2e9f2d3d96eb0862e7046f7128422410294278b8078182eb1e5d7'
    )
  );
  $$
);

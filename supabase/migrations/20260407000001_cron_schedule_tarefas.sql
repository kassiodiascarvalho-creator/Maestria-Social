-- Agenda o cron job que chama o worker de tarefas a cada minuto
DO $$
BEGIN
  PERFORM cron.unschedule('processar-tarefas-agendadas');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'processar-tarefas-agendadas',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://maestria-social.vercel.app/api/cron/processar-tarefas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer e2be246437c2e9f2d3d96eb0862e7046f7128422410294278b8078182eb1e5d7'
    )
  );
  $$
);

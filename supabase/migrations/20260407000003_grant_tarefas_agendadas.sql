-- Concede acesso à tabela para o PostgREST reconhecer no schema cache
GRANT ALL ON public.tarefas_agendadas TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.tarefas_agendadas TO authenticated;
GRANT SELECT ON public.tarefas_agendadas TO anon;

NOTIFY pgrst, 'reload schema';

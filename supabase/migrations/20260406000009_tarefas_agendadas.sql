-- Fila unificada de tarefas agendadas (emails, mensagens WhatsApp, recuperação de quiz)
CREATE TABLE IF NOT EXISTS public.tarefas_agendadas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('whatsapp_msg','email','recuperacao_quiz')),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  agendado_para   timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviada','erro','cancelada')),
  tentativas      int NOT NULL DEFAULT 0,
  ultimo_erro     text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  processado_em   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tarefas_pendentes
  ON public.tarefas_agendadas (agendado_para)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_tarefas_lead
  ON public.tarefas_agendadas (lead_id);

ALTER TABLE public.tarefas_agendadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access tarefas"
  ON public.tarefas_agendadas
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Módulo Forms: criação de formulários interativos com captura de leads

CREATE TABLE IF NOT EXISTS forms (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        UNIQUE NOT NULL,
  titulo          text        NOT NULL,
  descricao       text,
  modo_exibicao   text        NOT NULL DEFAULT 'uma_por_vez' CHECK (modo_exibicao IN ('uma_por_vez', 'todas_de_uma')),
  status          text        NOT NULL DEFAULT 'rascunho' CHECK (status IN ('ativo', 'rascunho', 'pausado')),
  config          jsonb       NOT NULL DEFAULT '{}',
  envio_email     text,
  envio_whatsapp  text,
  webhook_url     text,
  total_respostas integer     NOT NULL DEFAULT 0,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_questions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  tipo        text        NOT NULL CHECK (tipo IN (
    'nome','email','whatsapp','texto_curto','texto_longo',
    'multipla_escolha','pontuacao','sim_nao','data','upload'
  )),
  label       text        NOT NULL,
  descricao   text,
  placeholder text,
  opcoes      jsonb,
  obrigatorio boolean     NOT NULL DEFAULT true,
  ordem       integer     NOT NULL DEFAULT 0,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_responses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  lead_id     uuid        REFERENCES leads(id),
  completude  integer     NOT NULL DEFAULT 0,
  concluido   boolean     NOT NULL DEFAULT false,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_answers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid        NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  question_id uuid        NOT NULL REFERENCES form_questions(id),
  valor       text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_form_questions_form_id ON form_questions(form_id, ordem);
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_form_responses_lead_id ON form_responses(lead_id);
CREATE INDEX IF NOT EXISTS idx_form_answers_response_id ON form_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_form_answers_question_id ON form_answers(question_id);

-- Adiciona form_id ao leads para rastrear de qual form veio
ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_id uuid REFERENCES forms(id);

-- RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_answers ENABLE ROW LEVEL SECURITY;

-- Apenas service_role acessa (admin usa service_role; público usa API route dedicada)
CREATE POLICY "service_role_forms" ON forms FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_form_questions" ON form_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_form_responses" ON form_responses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_form_answers" ON form_answers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Função para incrementar contador de respostas
CREATE OR REPLACE FUNCTION incrementar_total_respostas(form_id_param uuid)
RETURNS void AS $$
BEGIN
  UPDATE forms SET total_respostas = total_respostas + 1, atualizado_em = now()
  WHERE id = form_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

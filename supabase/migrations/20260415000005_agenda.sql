-- ── Módulo Agenda ────────────────────────────────────────────────────────────
-- Pessoas (mentores, coaches, colaboradores)
CREATE TABLE IF NOT EXISTS agenda_pessoas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT NOT NULL,
  bio           TEXT DEFAULT '',
  role          TEXT DEFAULT '',           -- mentor, coach, colaborador…
  email         TEXT NOT NULL DEFAULT '',  -- e-mail para Google Calendar
  foto_url      TEXT,
  foto_pos_x    NUMERIC DEFAULT 0,         -- offset px do centro (drag)
  foto_pos_y    NUMERIC DEFAULT 0,
  foto_scale    NUMERIC DEFAULT 1,         -- zoom 1–3
  slug          TEXT UNIQUE NOT NULL,
  duracao_slot  INTEGER DEFAULT 30,        -- duração de cada slot em minutos
  google_refresh_token TEXT,              -- OAuth token (criptografado no futuro)
  ativo         BOOLEAN DEFAULT true,
  criado_em     TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_agenda_pessoas_atualizado_em
  BEFORE UPDATE ON agenda_pessoas
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- Grade semanal de horários
CREATE TABLE IF NOT EXISTS agenda_horarios (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id   UUID NOT NULL REFERENCES agenda_pessoas(id) ON DELETE CASCADE,
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 6=Sáb
  inicio      TIME NOT NULL,
  fim         TIME NOT NULL,
  ativo       BOOLEAN DEFAULT true
);

-- Exceções de calendário (bloqueios e horários extras)
CREATE TABLE IF NOT EXISTS agenda_excecoes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id   UUID NOT NULL REFERENCES agenda_pessoas(id) ON DELETE CASCADE,
  data        DATE NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('bloqueado', 'extra')),
  inicio      TIME,
  fim         TIME
);

-- Campos personalizáveis do formulário público
CREATE TABLE IF NOT EXISTS agenda_campos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id   UUID NOT NULL REFERENCES agenda_pessoas(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'text' CHECK (tipo IN ('text','email','phone','textarea','select')),
  obrigatorio BOOLEAN DEFAULT false,
  ordem       INTEGER DEFAULT 0,
  opcoes      JSONB  -- para tipo='select': ["Opção 1","Opção 2"]
);

-- Agendamentos
CREATE TABLE IF NOT EXISTS agenda_agendamentos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id       UUID NOT NULL REFERENCES agenda_pessoas(id) ON DELETE CASCADE,
  data            DATE NOT NULL,
  horario         TIME NOT NULL,
  nome_lead       TEXT NOT NULL,
  email_lead      TEXT NOT NULL,
  whatsapp_lead   TEXT,
  campos_extras   JSONB DEFAULT '{}',
  meet_link       TEXT,
  google_event_id TEXT,
  status          TEXT DEFAULT 'confirmado' CHECK (status IN ('confirmado','cancelado','realizado')),
  criado_em       TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE agenda_pessoas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_horarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_excecoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_campos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_agendamentos  ENABLE ROW LEVEL SECURITY;

-- Admin (service_role) — acesso total
CREATE POLICY "srole_agenda_pessoas"      ON agenda_pessoas      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "srole_agenda_horarios"     ON agenda_horarios     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "srole_agenda_excecoes"     ON agenda_excecoes     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "srole_agenda_campos"       ON agenda_campos       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "srole_agenda_agendamentos" ON agenda_agendamentos FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Público — leitura de perfis ativos + campos; insert de agendamentos
CREATE POLICY "anon_read_agenda_pessoas"      ON agenda_pessoas      FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "anon_read_agenda_horarios"     ON agenda_horarios     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_agenda_excecoes"     ON agenda_excecoes     FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_agenda_campos"       ON agenda_campos       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_agenda_agendamentos" ON agenda_agendamentos FOR INSERT TO anon WITH CHECK (true);

-- Seed: Dados de teste para desenvolvimento
-- ATENÇÃO: Executar APENAS em ambiente de desenvolvimento

-- Lead 1 — Nível Avançado, pilar fraco: Persuasão
INSERT INTO public.leads (id, nome, email, whatsapp, qs_total, qs_percentual, scores, pilar_fraco, nivel_qs, status_lead)
VALUES (
  'a1b2c3d4-0001-0000-0000-000000000001',
  'Carlos Mendes',
  'carlos@teste.com',
  '5511999990001',
  210, 84,
  '{"A": 45, "B": 42, "C": 40, "D": 38, "E": 45}',
  'Persuasão',
  'Avançado',
  'quente'
) ON CONFLICT (email) DO NOTHING;

-- Lead 2 — Nível Intermediário, pilar fraco: Relacionamento
INSERT INTO public.leads (id, nome, email, whatsapp, qs_total, qs_percentual, scores, pilar_fraco, nivel_qs, status_lead)
VALUES (
  'a1b2c3d4-0002-0000-0000-000000000002',
  'Ana Souza',
  'ana@teste.com',
  '5511999990002',
  175, 70,
  '{"A": 38, "B": 36, "C": 28, "D": 35, "E": 38}',
  'Relacionamento',
  'Intermediário',
  'morno'
) ON CONFLICT (email) DO NOTHING;

-- Lead 3 — Nível Iniciante, pilar fraco: Influência
INSERT INTO public.leads (id, nome, email, whatsapp, qs_total, qs_percentual, scores, pilar_fraco, nivel_qs, status_lead)
VALUES (
  'a1b2c3d4-0003-0000-0000-000000000003',
  'Pedro Lima',
  'pedro@teste.com',
  '5511999990003',
  130, 52,
  '{"A": 28, "B": 30, "C": 26, "D": 27, "E": 19}',
  'Influência',
  'Iniciante',
  'frio'
) ON CONFLICT (email) DO NOTHING;

-- Conversas para Carlos (lead quente)
INSERT INTO public.conversas (lead_id, role, mensagem) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'assistant', 'Olá Carlos! Vi que você atingiu 84% no seu Quociente Social — isso é excelente. Seu ponto de maior atenção está em Persuasão. Posso te perguntar uma coisa? Em que situações você sente que não consegue convencer as pessoas como gostaria?'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'user', 'Bom dia! Sim, principalmente em negociações de negócio. Sinto que perco o fio quando a pessoa começa a fazer objeções.'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'assistant', 'Faz todo sentido. Objeções são exatamente o ponto onde a maioria para — e onde os melhores avançam. Quando isso acontece, você costuma tentar responder a objeção diretamente ou tende a recuar?')
ON CONFLICT DO NOTHING;

-- Qualificações extraídas para Carlos
INSERT INTO public.qualificacoes (lead_id, campo, valor) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'maior_dor', 'Perde negociações quando surgem objeções'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'contexto', 'Empreendedor, lida com negociações B2B'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'interesse', 'Alto — respondeu rapidamente e demonstrou engajamento')
ON CONFLICT DO NOTHING;

-- Adiciona as novas plataformas ao CHECK constraint de vendas
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_plataforma_check;

ALTER TABLE vendas
  ADD CONSTRAINT vendas_plataforma_check
  CHECK (plataforma IN (
    'hotmart', 'kiwify', 'eduzz', 'hubla',
    'lastlink', 'cakto', 'monetizze', 'ticto', 'manual'
  ));

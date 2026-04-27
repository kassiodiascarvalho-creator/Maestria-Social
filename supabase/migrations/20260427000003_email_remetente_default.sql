-- Define remetente padrão para campanhas de e-mail
-- Garante que qualquer campanha sem remetente explícito use time@maestriasocial.com

ALTER TABLE email_campanhas
  ALTER COLUMN remetente_nome  SET DEFAULT 'Maestria Social',
  ALTER COLUMN remetente_email SET DEFAULT 'time@maestriasocial.com';

-- Corrige registros existentes com remetente vazio ou nulo
UPDATE email_campanhas
SET
  remetente_nome  = COALESCE(NULLIF(TRIM(remetente_nome),  ''), 'Maestria Social'),
  remetente_email = COALESCE(NULLIF(TRIM(remetente_email), ''), 'time@maestriasocial.com')
WHERE remetente_email IS NULL OR TRIM(remetente_email) = '';

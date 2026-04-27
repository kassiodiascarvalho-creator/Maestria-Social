-- Adiciona campos de validação WhatsApp em wpp_contatos
-- valido_wpp: null = não verificado, true = número existe no WA, false = inválido
ALTER TABLE wpp_contatos
  ADD COLUMN IF NOT EXISTS valido_wpp   boolean,
  ADD COLUMN IF NOT EXISTS validado_em  timestamptz;

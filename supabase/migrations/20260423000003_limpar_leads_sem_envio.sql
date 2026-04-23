-- Remove leads criados via disparo onde a mensagem nunca foi enviada com sucesso
-- (Baileys desconectado, erro de rede, etc.)
-- Cascata apaga automaticamente: conversas, qualificacoes, followup_lead_estado, etc.
DELETE FROM leads
WHERE via_disparo = true
  AND (disparo_confirmado = false OR disparo_confirmado IS NULL);

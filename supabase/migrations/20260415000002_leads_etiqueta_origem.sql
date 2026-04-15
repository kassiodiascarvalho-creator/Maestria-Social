-- Expande a tabela leads com campos de rastreamento de origem e etiqueta de atendimento

-- Nome da lista de disparo de origem (preenchido automaticamente no disparo)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origem text;

-- Etiqueta de atendimento: 'ia_atendendo' | 'humano_atendendo' | texto livre (colaborador)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS etiqueta text DEFAULT 'ia_atendendo';

-- Timestamp da última vez que um humano (admin) enviou mensagem manualmente
-- Usado pela regra de pausa: agente não responde por 5 min após atividade humana
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_atividade_humana timestamptz DEFAULT null;

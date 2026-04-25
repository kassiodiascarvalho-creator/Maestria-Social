-- Colunas de persona e roteamento inteligente de agentes
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS nome_persona TEXT DEFAULT NULL;
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS descricao_papel TEXT DEFAULT NULL;
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE agentes ADD COLUMN IF NOT EXISTS transferir_para_id UUID REFERENCES agentes(id) ON DELETE SET NULL;

-- Também garante que leads.agente_id exista (pode ter sido criado manualmente)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS agente_id UUID REFERENCES agentes(id) ON DELETE SET NULL;

COMMENT ON COLUMN agentes.nome_persona IS 'Nome humanizado da persona (ex: Carlos, Sofia)';
COMMENT ON COLUMN agentes.descricao_papel IS 'Papel/especialidade resumido (ex: especialista em vendas)';
COMMENT ON COLUMN agentes.is_default IS 'Se true, atende leads novos sem agente definido (recepcionista)';
COMMENT ON COLUMN agentes.transferir_para_id IS 'Agente padrão para onde este agente transfere leads';

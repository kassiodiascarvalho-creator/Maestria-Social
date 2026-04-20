-- Pipeline kanban e notas internas para o CRM
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_etapa text NOT NULL DEFAULT 'novo'
  CHECK (pipeline_etapa IN ('novo', 'em_contato', 'qualificado', 'proposta', 'agendado', 'convertido', 'perdido'));

ALTER TABLE leads ADD COLUMN IF NOT EXISTS notas_crm text;

COMMENT ON COLUMN leads.pipeline_etapa IS 'Etapa no pipeline de vendas — gerenciado via kanban';
COMMENT ON COLUMN leads.notas_crm IS 'Notas internas sobre o lead (visíveis apenas para o time)';

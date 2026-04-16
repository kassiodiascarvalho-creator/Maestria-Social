-- Adicionar WhatsApp do mentor (pessoa) para receber notificações de agendamento
ALTER TABLE agenda_pessoas ADD COLUMN IF NOT EXISTS whatsapp TEXT;

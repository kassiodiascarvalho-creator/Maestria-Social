-- Configura o link de agendamento padrão para o agente usar no WhatsApp
INSERT INTO configuracoes (chave, valor)
VALUES ('LINK_AGENDAMENTO', 'https://www.maestriasocial.com/agendar/jair-soares')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

-- Fila de mensagens pendentes da Meta API para debounce
-- Quando o lead manda várias mensagens em sequência, acumulamos aqui
-- antes de chamar o agente (espera 5s sem nova mensagem do mesmo phone)

CREATE TABLE IF NOT EXISTS mensagens_fila_meta (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  texto text NOT NULL,
  message_id text,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensagens_fila_meta_phone_idx ON mensagens_fila_meta (phone, criado_em);

-- Limpeza automática: remove registros com mais de 10 minutos (não processados por algum erro)
CREATE OR REPLACE FUNCTION limpar_fila_meta() RETURNS void AS $$
BEGIN
  DELETE FROM mensagens_fila_meta WHERE criado_em < now() - interval '10 minutes';
END;
$$ LANGUAGE plpgsql;

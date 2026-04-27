-- Função auxiliar para incrementar contadores nas tabelas de e-mail
-- Usada pelo tracking de abertura e clique sem precisar de duas queries

CREATE OR REPLACE FUNCTION increment_col(tbl TEXT, col TEXT, row_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
    tbl, col, col
  ) USING row_id;
END;
$$;

-- Força recarga do schema cache do PostgREST para reconhecer tabelas novas
NOTIFY pgrst, 'reload schema';

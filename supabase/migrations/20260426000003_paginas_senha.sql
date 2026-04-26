-- Salva o hash SHA-256 da senha de acesso ao módulo de Páginas
-- Senha: !nfOwest3r (nunca armazenar a senha em texto puro)
INSERT INTO configuracoes (chave, valor)
VALUES ('PAGINAS_SENHA_HASH', 'b183fd387b9a6d80e38f390e82b458270e517f3f1431f64ded2c7cb278fa39dd')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

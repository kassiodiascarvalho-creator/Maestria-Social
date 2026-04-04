# Coding Standards — Maetria Social

## Geral
- TypeScript estrito em todos os arquivos
- Imports absolutos com alias `@/*` (configurado no tsconfig)
- Nenhum `any` implícito
- Funções pequenas e focadas

## Next.js
- App Router (src/app/)
- Server Components por padrão
- Client Components apenas quando necessário (`'use client'`)
- Server Actions para mutações de dados

## Supabase
- Usar tipos gerados pelo Supabase
- RLS (Row Level Security) em todas as tabelas
- Nunca expor `service_role` key no cliente

## Nomenclatura
- Componentes: PascalCase
- Funções/variáveis: camelCase
- Arquivos de componente: kebab-case
- Constantes: UPPER_SNAKE_CASE

## Commits
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Mensagens em português

# Maestria Social — Brief Completo de Produto

> Documento para: @architect · @dev · @ux-design-expert · @devops

---

## 1. VISÃO DO PRODUTO

**Maestria Social** é uma plataforma SaaS completa de captação, qualificação e gestão de leads com Inteligência Artificial, voltada para o nicho de desenvolvimento de Inteligência Social.

A plataforma combina:
- Páginas públicas de captação e diagnóstico
- Um agente SDR com IA que aborda, sonda e qualifica leads automaticamente via WhatsApp
- Um dashboard interno para gestão completa dos leads e conversas
- Infraestrutura de API e Webhook próprios para integrações externas

**Domínio base:** `maestriasocial.com`

---

## 2. ESTRUTURA DE ROTAS

```
/                         → Página de captura (nome, email, WhatsApp)
/quiz                     → Quiz de diagnóstico QS (Quociente Social)
/dashboard                → Painel interno (acesso restrito — email + senha)
/dashboard/leads          → Lista de leads com status
/dashboard/leads/[id]     → Perfil completo do lead
/dashboard/agente         → Configuração do agente SDR
/dashboard/integracoes    → API Key própria + Webhook + Meta API
/api/webhook/meta         → Endpoint para receber mensagens da Meta
/api/leads                → CRUD de leads
/api/quiz                 → Salvar resultado do quiz
/api/agente/responder     → Processar mensagem recebida e gerar resposta
```

---

## 3. MÓDULOS DO PRODUTO

### 3.1 — Página de Captura (`/`)
- Campos: Nome completo, E-mail, WhatsApp (com máscara BR)
- CTA direto para o quiz após captura
- Design premium alinhado à identidade visual Maestria Social
- Salva lead no banco antes de redirecionar para `/quiz`

### 3.2 — Quiz de Diagnóstico QS (`/quiz`)
- 50 questões divididas em 5 seções (10 por seção)
- Escala Likert 1–5 por questão — Score máximo: 250 pontos
- Resultado: QS total, scores por pilar, nível, diagnóstico textual, CTA por pilar fraco
- Todo o resultado salvo no banco vinculado ao lead

### 3.3 — Agente SDR com IA
- Modelo: **OpenAI GPT-4.1 Mini**
- Canal: **Meta Cloud API (WhatsApp Business oficial)**
- Envia 1ª mensagem personalizada após quiz
- Conduz sondagem adaptativa por pilar fraco
- Classifica lead: 🔴 Frio · 🟡 Morno · 🟢 Quente
- Roteiro por pilar: Comunicação / Persuasão / Relacionamento / Sociabilidade / Influência

### 3.4 — Dashboard Interno (`/dashboard`)
- Autenticação via Supabase Auth
- Lista de leads com filtros
- Perfil completo do lead com histórico de conversa
- Kanban por temperatura de lead
- Métricas gerais

### 3.5 — Integrações e API Própria
- API Key própria gerada por usuário
- Webhook de entrada e saída configurável
- Meta Cloud API configurada no painel
- OpenAI API Key configurada no painel

---

## 4. BANCO DE DADOS

### `leads`
```sql
id uuid PK | nome text | email text | whatsapp text
qs_total integer | qs_percentual integer | scores jsonb
pilar_fraco text | nivel_qs text | status_lead text
criado_em timestamptz | atualizado_em timestamptz
```

### `conversas`
```sql
id uuid PK | lead_id uuid FK | role text | mensagem text | criado_em timestamptz
```

### `qualificacoes`
```sql
id uuid PK | lead_id uuid FK | campo text | valor text | criado_em timestamptz
```

### `api_keys`
```sql
id uuid PK | nome text | chave text UNIQUE | ativa boolean | criado_em timestamptz
```

### `webhook_configs`
```sql
id uuid PK | evento text | url text | ativo boolean | criado_em timestamptz
```

---

## 5. FLUXO COMPLETO

```
1. Lead acessa maestriasocial.com
2. Preenche nome, email, WhatsApp → salvo com status "frio"
3. Redirecionado para /quiz
4. Responde 50 questões
5. Resultado exibido + salvo no banco
6. OpenAI gera 1ª mensagem personalizada
7. Meta API envia no WhatsApp
8. Lead responde → /api/webhook/meta
9. Backend busca lead + histórico
10. OpenAI responde + extrai qualificações (JSON)
11. Backend salva + Meta envia resposta
12. OpenAI atualiza status do lead
13. Dashboard atualiza em tempo real
14. Loop até qualificação completa
```

---

## 6. STACK TECNOLÓGICA

| Camada | Tecnologia |
|---|---|
| Frontend + Backend | Next.js 15 (App Router) |
| Banco de dados | Supabase (PostgreSQL + Auth + Realtime) |
| IA / Agente | OpenAI GPT-4.1 Mini |
| WhatsApp | Meta Cloud API (oficial) |
| Email | Resend |
| Hospedagem | Vercel (frontend) |
| Estilização | Tailwind CSS |
| Linguagem | TypeScript |

---

## 7. IDENTIDADE VISUAL

### Paleta Oficial
| Nome | Papel | HEX |
|---|---|---|
| Preto | Background principal | `#0e0f09` |
| Marrom | Surface / cards | `#30241d` |
| Caramelo | Cor primária / destaque | `#c2904d` |
| Palha | Hover / texto de apoio | `#fee69d` |
| Off White | Textos principais | `#fff9e6` |

### Tipografia
| Fonte | Uso |
|---|---|
| **Athena** (Adobe Fonts) | Títulos, headlines — fonte principal da marca |
| **Inter** | Corpo, UI, labels |

> ⚠️ Athena é paga (Adobe Fonts). Usar **Cormorant Garamond** como fallback até adquirir.
> Substituir DM Sans por **Inter** em todo o projeto.

### Foto Principal
- Gustavo — polo dourada/caramelo, ambiente escuro e dramático

---

## 8. SEGURANÇA
- Supabase Auth no dashboard
- API Keys com hash no banco
- Validação de assinatura nos webhooks
- Rate limiting nas rotas públicas
- RLS ativo no Supabase

---

## 9. PERFORMANCE
- Quiz: LCP < 1.5s
- Respostas do agente: < 3s
- Dashboard com paginação e lazy loading
- Webhooks processados de forma assíncrona

---

## 10. AGENTES AIOX

| Agente | Responsabilidade |
|---|---|
| `@architect` | Arquitetura, estrutura de pastas, decisões técnicas |
| `@dev` | Código completo (Next.js, API, banco, integrações) |
| `@ux-design-expert` | Design de todos os módulos com identidade visual |
| `@devops` | Deploy, CI/CD, env vars, monitoramento |

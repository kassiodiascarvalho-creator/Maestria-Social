# 🚀 Setup WhatsApp Webhook — Checklist Rápido

## ✅ Passo 1: Verificar Credenciais (2 min)

### No Supabase Dashboard:
1. Abra [Console Supabase](https://app.supabase.com)
2. Vá em **SQL Editor**
3. Execute primeira query do `register-webhook.sql` para verificar se tem `META_ACCESS_TOKEN` e `META_PHONE_NUMBER_ID`

**Devem aparecer 2 linhas:**
```
META_ACCESS_TOKEN    | EAAxx...
META_PHONE_NUMBER_ID | 123456789
```

❌ **Se não aparecer?** 
- Vá em **Dashboard > Integrações** e configure os dois valores
- Ou execute SQL direto:
```sql
INSERT INTO configuracoes (chave, valor) VALUES ('META_ACCESS_TOKEN', 'seu-token-aqui');
INSERT INTO configuracoes (chave, valor) VALUES ('META_PHONE_NUMBER_ID', 'seu-numero-id-aqui');
```

---

## ✅ Passo 2: Registrar o Webhook (1 min)

1. Volte ao **SQL Editor**
2. Copie TODO o conteúdo de `register-webhook.sql`
3. Cole no SQL Editor e execute

**Deve aparecer um resultado com 4 linhas** (um para cada evento: `mensagem_recebida`, `lead_qualificado`, `status_atualizado`, `novo_lead`)

---

## ✅ Passo 3: Deploy da Supabase Function (2 min)

### Via Supabase CLI:

```bash
# 1. Do terminal, na raiz do projeto
cd C:\Users\kassi\Maestria-Social

# 2. Deploy da função
supabase functions deploy whatsapp-webhook --no-verify-jwt

# 3. Verificar se foi deployed
supabase functions list
```

**Esperado:**
```
whatsapp-webhook   https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook
```

---

## ✅ Passo 4: Teste Rápido (1 min)

### Execute o script de teste:
```bash
# Substitua 5511987654321 pelo seu número de WhatsApp para teste
node test-webhook.mjs
```

**Esperado:**
```
✅ TESTE 1 PASSOU!
✅ TESTE 2 PASSOU!
🎉 TODOS OS TESTES PASSARAM!
```

❌ **Se der erro?**
- Verifique o `WEBHOOK_SECRET` no `test-webhook.mjs` — deve ser o mesmo de `register-webhook.sql`
- Verifique se os credenciais (`META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`) estão corretos
- Check logs da função: `supabase functions logs whatsapp-webhook`

---

## 🧪 O que o Teste Valida?

### Teste 1: Mensagem Recebida
- ✅ Webhook recebe payload com evento `mensagem_recebida`
- ✅ Valida assinatura HMAC
- ✅ Dispara um "echo" da mensagem via WhatsApp

### Teste 2: Lead Qualificado
- ✅ Webhook recebe payload com evento `lead_qualificado`
- ✅ Valida assinatura HMAC
- ✅ Dispara mensagem personalizada via WhatsApp

---

## 🔌 Integração com o Fluxo Real

Depois dos testes passarem, o sistema vai:

1. **Quando alguém manda mensagem no WhatsApp:**
   - Meta envia para seu webhook Meta (recebe em `src/app/api/webhook/meta/route.ts`)
   - Maestria processa a mensagem
   - Dispara webhook para `whatsapp-webhook` 
   - Mensagem é respondida automaticamente pro cliente

2. **Quando o quiz é finalizado:**
   - Gera qualificação do lead
   - Dispara webhook com evento `lead_qualificado`
   - Cliente recebe mensagem personalizada no WhatsApp

---

## 📋 Troubleshooting

| Problema | Solução |
|----------|---------|
| Status 401 "Invalid signature" | Assinatura HMAC não confere. Verifique `WEBHOOK_SECRET` |
| Status 500 "Configuração incompleta" | `META_ACCESS_TOKEN` ou `META_PHONE_NUMBER_ID` não estão na DB |
| Mensagem não chega no WhatsApp | Token do Meta expirou ou número bloqueia |
| Function não faz deploy | Execute: `supabase functions deploy whatsapp-webhook --no-verify-jwt` |

---

## 🚀 Próximos Passos

✅ Após passar nos testes:

1. **Testar no fluxo real:**
   - Enviar mensagem via WhatsApp para o número do Maestria
   - Verificar se recebe echo
   - Fazer o quiz
   - Verificar se recebe mensagem de qualificação

2. **Monitorar logs:**
   - Dashboard: [Supabase Logs](https://app.supabase.com)
   - CLI: `supabase functions logs whatsapp-webhook`

3. **Customizar mensagens:**
   - Editar `supabase/functions/whatsapp-webhook/index.ts`
   - Modificar os textos em cada `case event:`
   - Deploy novamente: `supabase functions deploy whatsapp-webhook --no-verify-jwt`

---

**Dúvidas?** Avisa aqui! 🚀

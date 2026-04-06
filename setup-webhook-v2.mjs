#!/usr/bin/env node

import https from "https";
import crypto from "crypto";

const SUPABASE_URL = "https://wzuunuyrgpwjohfbnglf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6dXVudXlyZ3B3am9oZmJuZ2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4MTcwMDQsImV4cCI6MjAyNTM5MzAwNH0.YWTWkNrpqCfqMHCmUe8D1rOzrC-TqnBVsJFfH9mPGjc";

const WEBHOOK_URL = "https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook";
const WEBHOOK_SECRET = "seu-secret-aqui-123";
const WHATSAPP_NUMERO = "5533984522635";

function assinarPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function makeRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const options = {
      hostname: requestUrl.hostname,
      port: requestUrl.port || 443,
      path: requestUrl.pathname + requestUrl.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(body && { "Content-Length": Buffer.byteLength(body) }),
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (body) req.write(body);
    req.end();
  });
}

async function verificarCredenciais() {
  console.log("\n📋 Verificando Credenciais...");
  console.log("─".repeat(60));

  try {
    const response = await makeRequest(
      `${SUPABASE_URL}/rest/v1/configuracoes?select=chave,valor&chave=in.("META_ACCESS_TOKEN","META_PHONE_NUMBER_ID")`,
      "GET",
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      }
    );

    if (response.status === 200 && Array.isArray(response.data) && response.data.length >= 2) {
      console.log("✅ Credenciais encontradas:");
      response.data.forEach((c) => {
        const valor = c.valor?.substring(0, 10) + "...";
        console.log(`  ${c.chave}: ${valor}`);
      });
      return true;
    } else {
      console.warn("⚠️  Nem todas as credenciais estão configuradas");
      console.log("📝 Valores encontrados:", response.data);
      return false;
    }
  } catch (err) {
    console.error("❌ Erro ao verificar credenciais:", err);
    return false;
  }
}

async function registrarWebhook() {
  console.log("\n⚙️  Registrando Webhook...");
  console.log("─".repeat(60));

  const eventosParaRegistrar = ["mensagem_recebida", "lead_qualificado", "status_atualizado", "novo_lead"];

  try {
    for (const evento of eventosParaRegistrar) {
      const payload = {
        evento,
        url: WEBHOOK_URL,
        secret: WEBHOOK_SECRET,
        ativo: true,
      };

      const response = await makeRequest(
        `${SUPABASE_URL}/rest/v1/webhook_configs`,
        "POST",
        {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "return=minimal",
        },
        JSON.stringify(payload)
      );

      if (response.status === 201 || response.status === 200) {
        console.log(`  ✅ ${evento}`);
      } else {
        console.log(`  ⚠️  ${evento} - Status ${response.status}`);
      }
    }

    const verify = await makeRequest(
      `${SUPABASE_URL}/rest/v1/webhook_configs?url=like.%whatsapp-webhook%`,
      "GET",
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      }
    );

    if (Array.isArray(verify.data) && verify.data.length > 0) {
      console.log(`\n✅ Webhooks registrados: ${verify.data.length}`);
      return true;
    } else {
      console.warn("⚠️  Não foi possível verificar os webhooks registrados");
      return true;
    }
  } catch (err) {
    console.error("❌ Erro ao registrar webhook:", err);
    return false;
  }
}

async function testeWebhook() {
  console.log("\n🧪 Testando Webhook...");
  console.log("─".repeat(60));

  console.log("\n📨 TESTE 1: Mensagem Recebida");

  const payload1 = {
    evento: "mensagem_recebida",
    timestamp: new Date().toISOString(),
    data: {
      lead_id: "lead-123-teste",
      nome: "João Silva",
      email: "joao@test.com",
      whatsapp: WHATSAPP_NUMERO,
      mensagem: "Olá! Quero saber mais sobre os planos!",
    },
  };

  const payloadStr1 = JSON.stringify(payload1);
  const signature1 = assinarPayload(payloadStr1, WEBHOOK_SECRET);

  try {
    const response1 = await makeRequest(
      WEBHOOK_URL,
      "POST",
      {
        "x-maestria-signature": signature1,
      },
      payloadStr1
    );

    if (response1.status === 200) {
      console.log(`✅ Status: ${response1.status}`);
      console.log(`✅ TESTE 1 PASSOU!`);
    } else {
      console.warn(`⚠️  Status: ${response1.status}`);
      console.log(response1.data);
    }
  } catch (err) {
    console.error("❌ Erro no teste 1:", err);
  }

  console.log("\n🎯 TESTE 2: Lead Qualificado");

  const payload2 = {
    evento: "lead_qualificado",
    timestamp: new Date().toISOString(),
    data: {
      lead_id: "lead-456-teste",
      nome: "Maria Santos",
      email: "maria@test.com",
      whatsapp: WHATSAPP_NUMERO,
      status_anterior: "frio",
      status_atual: "quente",
    },
  };

  const payloadStr2 = JSON.stringify(payload2);
  const signature2 = assinarPayload(payloadStr2, WEBHOOK_SECRET);

  try {
    const response2 = await makeRequest(
      WEBHOOK_URL,
      "POST",
      {
        "x-maestria-signature": signature2,
      },
      payloadStr2
    );

    if (response2.status === 200) {
      console.log(`✅ Status: ${response2.status}`);
      console.log(`✅ TESTE 2 PASSOU!`);
    } else {
      console.warn(`⚠️  Status: ${response2.status}`);
      console.log(response2.data);
    }
  } catch (err) {
    console.error("❌ Erro no teste 2:", err);
  }

  console.log("\n✅ Testes completos!");
}

async function main() {
  console.log("\n🚀 SETUP WEBHOOK WHATSAPP");
  console.log("═".repeat(60));
  console.log(`URL Webhook: ${WEBHOOK_URL}`);
  console.log(`Número Teste: ${WHATSAPP_NUMERO}`);
  console.log(`Secret: ${WEBHOOK_SECRET}`);

  const hasCredenciais = await verificarCredenciais();
  
  if (!hasCredenciais) {
    console.warn("\n⚠️  Credenciais incompletas. Configure META_ACCESS_TOKEN e META_PHONE_NUMBER_ID");
  }

  const webhookRegistrado = await registrarWebhook();

  if (webhookRegistrado) {
    await testeWebhook();
  }

  console.log("\n" + "═".repeat(60));
  console.log("✅ Setup completo!");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});

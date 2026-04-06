#!/usr/bin/env node

import https from "https";
import crypto from "crypto";

const WEBHOOK_URL = "https://dhudmbbgdyxdxypixyis.supabase.co/functions/v1/whatsapp-webhook";
const WEBHOOK_SECRET = "seu-secret-aqui-123";
const WHATSAPP_NUMERO = "5533984522635";

console.log("\n🔍 DIAGNÓSTICO DO WEBHOOK");
console.log("═".repeat(60));
console.log(`URL: ${WEBHOOK_URL}`);
console.log(`Número: ${WHATSAPP_NUMERO}`);
console.log("═".repeat(60));

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
          resolve({ status: res.statusCode, statusText: res.statusMessage, data: parsed });
        } catch {
          resolve({ status: res.statusCode, statusText: res.statusMessage, data });
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

async function teste() {
  const payload = {
    evento: "mensagem_recebida",
    timestamp: new Date().toISOString(),
    data: {
      lead_id: "lead-diag-123",
      nome: "Diagnóstico",
      email: "diag@test.com",
      whatsapp: WHATSAPP_NUMERO,
      mensagem: "Teste de diagnóstico",
    },
  };

  const payloadStr = JSON.stringify(payload);
  const signature = assinarPayload(payloadStr, WEBHOOK_SECRET);

  console.log("\n📤 Enviando requisição...");
  console.log(`Assinatura: ${signature.substring(0, 20)}...`);

  try {
    const response = await makeRequest(
      WEBHOOK_URL,
      "POST",
      {
        "x-maestria-signature": signature,
      },
      payloadStr
    );

    console.log(`\n📊 Resposta HTTP`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Dados:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data.ok) {
      console.log("\n✅ WEBHOOK FUNCIONANDO CORRETAMENTE!");
      console.log(`MessageID: ${response.data.messageId}`);
    } else if (response.status === 404) {
      console.log("\n⚠️  FUNÇÃO NÃO ENCONTRADA (404)");
      console.log("Possíveis causas:");
      console.log("  - Função não foi deployada no Supabase");
      console.log("  - URL incorreta");
      console.log("  - Projeto errado");
      console.log("\n✨ Solução:");
      console.log("  1. Abra: https://supabase.com/dashboard/project/dhudmbbgdyxdxypixyis/functions");
      console.log("  2. Crie uma nova função chamada 'whatsapp-webhook'");
      console.log("  3. Cole o código TypeScript fornecido");
      console.log("  4. Clique em Deploy");
    } else if (response.status === 400) {
      console.log("\n⚠️  ERRO DE PAYLOAD (400)");
      console.log("Verifique se o JSON está correto");
    } else if (response.status === 401) {
      console.log("\n⚠️  ERRO DE AUTENTICAÇÃO (401)");
      console.log("Assinatura inválida ou não configurada corretamente");
    } else if (response.status === 500) {
      console.log("\n⚠️  ERRO INTERNO (500)");
      console.log("A função tem um erro interno");
      console.log("Verifique os logs no Supabase Dashboard");
    }
  } catch (err) {
    console.error("\n❌ Erro de conexão:", err.message);
    console.log("\nPossíveis causas:");
    console.log("  - Sem conexão com internet");
    console.log("  - URL incorreta");
    console.log("  - Firewall bloqueando");
  }
}

teste().catch(console.error);

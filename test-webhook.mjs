#!/usr/bin/env node

/**
 * 🧪 Teste Rápido do Webhook WhatsApp
 * 
 * Executa 2 requisições de teste:
 * 1. Simula uma mensagem recebida
 * 2. Simula um lead qualificado
 */

import https from "https";
import crypto from "crypto";

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const WEBHOOK_URL =
  "https://wzuunuyrgpwjohfbnglf.supabase.co/functions/v1/whatsapp-webhook";
const WEBHOOK_SECRET = "seu-secret-aqui-123"; // DEVE SER O MESMO DO BD
const WHATSAPP_NUMERO = "5533984522635"; // Número para teste

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function assinarPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function makeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const options = {
      hostname: requestUrl.hostname,
      port: requestUrl.port || 443,
      path: requestUrl.pathname + requestUrl.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
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

    req.write(body);
    req.end();
  });
}

// ─── TESTES ──────────────────────────────────────────────────────────────────
async function teste1_MensagemRecebida() {
  console.log("\n📨 TESTE 1: Mensagem Recebida");
  console.log("─".repeat(60));

  const payload = {
    evento: "mensagem_recebida",
    timestamp: new Date().toISOString(),
    data: {
      lead_id: "lead-123-teste",
      nome: "João Silva",
      email: "joao@test.com",
      whatsapp: WHATSAPP_NUMERO, // Número compartilhado para teste
      mensagem: "Olá! Quero saber mais sobre os planos!",
    },
  };

  const payloadStr = JSON.stringify(payload);
  const signature = assinarPayload(payloadStr, WEBHOOK_SECRET);

  console.log("📤 Payload enviado:");
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await makeRequest(
      WEBHOOK_URL,
      "POST",
      {
        "x-maestria-signature": signature,
      },
      payloadStr
    );

    console.log(`\n✅ Status: ${response.status}`);
    console.log("📥 Resposta:");
    console.log(JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log("✅ TESTE 1 PASSOU!");
      return true;
    } else {
      console.log("❌ TESTE 1 FALHOU!");
      return false;
    }
  } catch (err) {
    console.error("❌ Erro ao fazer requisição:", err);
    return false;
  }
}

async function teste2_LeadQualificado() {
  console.log("\n🎯 TESTE 2: Lead Qualificado");
  console.log("─".repeat(60));

  const payload = {
    evento: "lead_qualificado",
    timestamp: new Date().toISOString(),
    data: {
      lead_id: "lead-456-teste",
      nome: "Maria Santos",
      email: "maria@test.com",
      whatsapp: WHATSAPP_NUMERO, // Número compartilhado para teste
      status_anterior: "frio",
      status_atual: "quente",
    },
  };

  const payloadStr = JSON.stringify(payload);
  const signature = assinarPayload(payloadStr, WEBHOOK_SECRET);

  console.log("📤 Payload enviado:");
  console.log(JSON.stringify(payload, null, 2));

  try {
    const response = await makeRequest(
      WEBHOOK_URL,
      "POST",
      {
        "x-maestria-signature": signature,
      },
      payloadStr
    );

    console.log(`\n✅ Status: ${response.status}`);
    console.log("📥 Resposta:");
    console.log(JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log("✅ TESTE 2 PASSOU!");
      return true;
    } else {
      console.log("❌ TESTE 2 FALHOU!");
      return false;
    }
  } catch (err) {
    console.error("❌ Erro ao fazer requisição:", err);
    return false;
  }
}

// ─── EXECUÇÃO ────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 TESTES WEBHOOK WHATSAPP");
  console.log("═".repeat(60));
  console.log(`URL: ${WEBHOOK_URL}`);
  console.log(`Secret: ${WEBHOOK_SECRET}`);

  const teste1 = await teste1_MensagemRecebida();
  const teste2 = await teste2_LeadQualificado();

  console.log("\n" + "═".repeat(60));
  console.log("📊 RESULTADO FINAL:");
  console.log(`  Teste 1 (Mensagem): ${teste1 ? "✅ PASSOU" : "❌ FALHOU"}`);
  console.log(`  Teste 2 (Qualificado): ${teste2 ? "✅ PASSOU" : "❌ FALHOU"}`);

  if (teste1 && teste2) {
    console.log("\n🎉 TODOS OS TESTES PASSARAM!");
    process.exit(0);
  } else {
    console.log("\n⚠️  ALGUNS TESTES FALHARAM");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});

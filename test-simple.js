#!/usr/bin/env node

const https = require('https');
const crypto = require('crypto');

const WEBHOOK_URL = 'https://dhudmbbgdyxdxypixyis.supabase.co/functions/v1/whatsapp-webhook';
const WEBHOOK_SECRET = 'seu-secret-aqui-123';
const WHATSAPP_NUMERO = '5533984522635';

function assinarPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

console.log('\n🧪 TESTE DO WEBHOOK WHATSAPP');
console.log('═'.repeat(60));
console.log(`URL: ${WEBHOOK_URL}`);
console.log(`Número: ${WHATSAPP_NUMERO}`);
console.log('═'.repeat(60));

// Teste 1
const payload1 = {
  evento: 'mensagem_recebida',
  timestamp: new Date().toISOString(),
  data: {
    lead_id: 'lead-teste-123',
    nome: 'João',
    email: 'joao@test.com',
    whatsapp: WHATSAPP_NUMERO,
    mensagem: 'Olá! Teste do webhook!',
  },
};

const payloadStr1 = JSON.stringify(payload1);
const signature1 = assinarPayload(payloadStr1, WEBHOOK_SECRET);

console.log('\n📨 TESTE 1: Mensagem Recebida');
console.log('Enviando...');

const urlObj = new URL(WEBHOOK_URL);
const options = {
  hostname: urlObj.hostname,
  port: 443,
  path: urlObj.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadStr1),
    'x-maestria-signature': signature1,
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(data);
      console.log('Resposta:', JSON.stringify(parsed, null, 2));
    } catch {
      console.log('Resposta (raw):', data);
    }
    console.log('✅ TESTE 1 COMPLETO\n');
  });
});

req.on('error', (err) => {
  console.error('❌ Erro:', err.message);
});

req.write(payloadStr1);
req.end();

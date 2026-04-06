import { createHmac } from "node:crypto";

interface WebhookPayload {
  evento: string;
  timestamp: string;
  data: {
    lead_id?: string;
    nome?: string;
    email?: string;
    whatsapp?: string;
    mensagem?: string;
    status_anterior?: string;
    status_atual?: string;
  };
}

interface MetaResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string };
}

function validarAssinatura(payload: string, signature: string, secret: string): boolean {
  const assinatura = createHmac("sha256", secret).update(payload).digest("hex");
  return assinatura === signature;
}

async function dispararWhatsApp(
  phoneNumber: string,
  mensagem: string,
  metaToken: string,
  phoneNumberId: string
): Promise<{ status: string; messageId?: string }> {
  if (!metaToken || !phoneNumberId) {
    console.log(`[WhatsApp TEST] Seria enviado para ${phoneNumber}: ${mensagem}`);
    return { status: "TEST MODE", messageId: "test-" + Date.now() };
  }

  const url = `https://graph.instagram.com/v18.0/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${metaToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "text",
      text: { body: mensagem },
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`[WhatsApp] Erro: ${response.status} - ${errorData}`);
    throw new Error(`WhatsApp error: ${response.status}`);
  }

  const result = (await response.json()) as MetaResponse;
  return { status: "sent", messageId: result.messages?.[0]?.id };
}

async function obterCredenciais() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return {};
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/configuracoes?select=chave,valor`, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return {};

    const data = await response.json();
    const credenciais: Record<string, string> = {};

    if (Array.isArray(data)) {
      data.forEach((c) => {
        if (c.chave && c.valor) credenciais[c.chave] = c.valor;
      });
    }

    return credenciais;
  } catch (err) {
    console.warn("[obterCredenciais] Erro:", err);
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const secret = Deno.env.get("WEBHOOK_SECRET") || "seu-secret-padrao";
    const credenciais = await obterCredenciais();
    const metaToken = credenciais["META_ACCESS_TOKEN"] || "";
    const phoneNumberId = credenciais["META_PHONE_NUMBER_ID"] || "";

    const rawBody = await req.text();
    let payload: WebhookPayload;

    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const signature = req.headers.get("x-maestria-signature");
    if (signature && !validarAssinatura(rawBody, signature, secret)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { evento, data } = payload;
    console.log(`[Webhook] ${evento} para ${data.whatsapp}`);

    if (!data.whatsapp) {
      return new Response(
        JSON.stringify({ warning: "Phone number not provided" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let resultado = { ok: false, evento, messageId: "" };

    try {
      switch (evento) {
        case "mensagem_recebida": {
          const texto = `🤖 Echo: "${data.mensagem}"`;
          const res = await dispararWhatsApp(data.whatsapp, texto, metaToken, phoneNumberId);
          resultado = { ok: true, evento, messageId: res.messageId || "" };
          break;
        }

        case "lead_qualificado": {
          const texto = `Olá ${data.nome}! 🎉\nSeus dados foram qualificados!\nStatus: ${data.status_atual}\n\nEm breve entraremos em contato.`;
          const res = await dispararWhatsApp(data.whatsapp, texto, metaToken, phoneNumberId);
          resultado = { ok: true, evento, messageId: res.messageId || "" };
          break;
        }

        case "status_atualizado": {
          const emoji =
            data.status_atual === "quente" ? "🔥" : data.status_atual === "morno" ? "🌡️" : "❄️";
          const texto = `Seu status foi atualizado!\nAnterior: ${data.status_anterior}\nNovo: ${data.status_atual} ${emoji}`;
          const res = await dispararWhatsApp(data.whatsapp, texto, metaToken, phoneNumberId);
          resultado = { ok: true, evento, messageId: res.messageId || "" };
          break;
        }

        case "novo_lead": {
          const texto = `Olá ${data.nome}! 👋\nBem-vindo ao Maestria Social!\nEstamos analisando seus dados...`;
          const res = await dispararWhatsApp(data.whatsapp, texto, metaToken, phoneNumberId);
          resultado = { ok: true, evento, messageId: res.messageId || "" };
          break;
        }

        default:
          resultado = { ok: false, evento, messageId: "unknown-event" };
      }
    } catch (err) {
      console.error(`[${evento}]  Erro:`, err);
      resultado = { ok: false, evento, messageId: "" };
    }

    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Unhandled]", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

        return new Response(
          JSON.stringify({ warning: "Unknown event type" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("[WhatsApp] Erro não tratado:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

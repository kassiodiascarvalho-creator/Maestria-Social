import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYSTEM = `Você é um especialista sênior em marketing digital, lançamentos e automação de WhatsApp no mercado brasileiro.
Crie fluxos de cadência profissionais, persuasivos e com alta conversão.

RETORNE APENAS JSON VÁLIDO — sem markdown, sem texto extra, sem comentários.
Estrutura obrigatória: { "nodes": [...], "edges": [...] }

════════ TIPOS DE NÓS DISPONÍVEIS ════════

1. INÍCIO (tipo: "inicio") — sempre o primeiro nó
{"id":"n1","type":"inicio","position":{"x":340,"y":40},"data":{"label":"Início","trigger_tipo":"form_submit","trigger_config":{}}}
trigger_tipo: "form_submit" | "manual" | "tag_add" | "lead_criado" | "sdr" | "import"

2. MENSAGEM (tipo: "mensagem")
{"id":"n2","type":"mensagem","position":{"x":340,"y":200},"data":{"label":"Boas-vindas","tipo":"texto","texto":"Olá {nome}! 👋 Mensagem aqui.\\n\\nSegundo parágrafo 🚀"}}
tipo: "texto" | "imagem" | "audio" | "video" | "documento"
Se tipo != "texto": adicione "url_midia": "https://..." e "legenda": "..."

3. AGUARDAR (tipo: "aguardar")
{"id":"n3","type":"aguardar","position":{"x":340,"y":360},"data":{"label":"Aguardar 1 dia","quantidade":1,"unidade":"dias"}}
unidade: "minutos" | "horas" | "dias"

4. CONDIÇÃO (tipo: "condicao")
{"id":"n4","type":"condicao","position":{"x":340,"y":520},"data":{"label":"Tem WhatsApp?","campo":"whatsapp","operador":"existe","valor":""}}
campo: "nome" | "email" | "whatsapp" | "origem" | "utm_source" | "tags"
operador: "existe" | "nao_existe" | "igual" | "contem" | "nao_contem"

5. TAG (tipo: "tag")
{"id":"n5","type":"tag","position":{"x":340,"y":680},"data":{"label":"Tag: lead-quente","tag":"lead-quente"}}

6. AGENTE IA (tipo: "agente_ia")
{"id":"n6","type":"agente_ia","position":{"x":340,"y":840},"data":{"label":"SDR — Qualificação","instrucoes":"Qualifique o lead e ofereça sessão gratuita."}}

7. WEBHOOK (tipo: "webhook")
{"id":"n7","type":"webhook","position":{"x":340,"y":1000},"data":{"label":"Notificar CRM","url":"https://webhook.site/...","metodo":"POST","descricao":"Envia dados do lead"}}

8. FIM (tipo: "fim") — último nó de cada caminho
{"id":"n8","type":"fim","position":{"x":340,"y":1160},"data":{"label":"Fim do fluxo"}}

════════ EDGES ════════
Conexão simples: {"id":"e1-2","source":"n1","target":"n2"}
Condição SIM/NÃO: {"id":"e4-5","source":"n4","target":"n5","sourceHandle":"sim"} e {"id":"e4-6","source":"n4","target":"n6","sourceHandle":"nao"}

════════ REGRAS ════════
- Gere 8 a 10 nós (fluxo rico mas conciso)
- Mensagens com emojis, {nome}, gatilhos mentais, máx 600 chars cada
- Sempre 1 condição para bifurcar leads engajados
- y cresce 160px por nó. Ramos paralelos: x diferente (+300 ou -300)
- Termine todo caminho com nó "fim"
- Use \\n para quebras de linha no JSON`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { descricao, trigger_tipo } = body as { descricao?: string; trigger_tipo?: string }

  if (!descricao?.trim()) {
    return NextResponse.json({ error: 'descricao required' }, { status: 400 })
  }

  try {
    const result = streamText({
      model: openai('gpt-4o-mini'),
      temperature: 0.6,
      maxOutputTokens: 3500,
      system: SYSTEM,
      prompt: `Crie um fluxo de cadência (8-10 nós) para:\n"${descricao}"\nGatilho: ${trigger_tipo || 'form_submit'}\nRetorne APENAS JSON: { "nodes": [...], "edges": [...] }`,
    })

    return result.toTextStreamResponse()
  } catch (err) {
    console.error('[gerar-ia] erro:', err)
    return NextResponse.json({ error: 'Falha ao gerar fluxo' }, { status: 500 })
  }
}

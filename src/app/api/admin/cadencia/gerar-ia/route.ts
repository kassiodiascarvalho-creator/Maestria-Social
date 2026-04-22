import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM = `Você é um especialista em marketing digital e automação de WhatsApp.
Gere um fluxo de cadência em JSON com base na descrição do usuário.

REGRAS:
- Retorne APENAS JSON válido, sem markdown, sem texto extra
- nodes: array de nós do fluxo
- edges: array de conexões entre nós
- IDs de nós devem ser strings únicas como "n1", "n2", etc.
- Posições (pos_x, pos_y) devem criar um layout vertical organizado, espaço de 160px entre nós no eixo Y
- Primeiro nó sempre tipo "inicio", último sempre tipo "fim"
- Tipos válidos: inicio, mensagem, aguardar, condicao, tag, agente_ia, fim

ESTRUTURA DE UM NÓ:
{
  "id": "n1",
  "type": "inicio",
  "position": { "x": 300, "y": 50 },
  "data": {
    "label": "Início",
    "trigger_tipo": "form_submit",
    "trigger_config": {}
  }
}

ESTRUTURA MENSAGEM:
{
  "id": "n2",
  "type": "mensagem",
  "position": { "x": 300, "y": 210 },
  "data": {
    "label": "Boas-vindas",
    "texto": "Olá {nome}! 👋 Seja bem-vindo(a)...",
    "tipo": "texto"
  }
}

ESTRUTURA AGUARDAR:
{
  "id": "n3",
  "type": "aguardar",
  "position": { "x": 300, "y": 370 },
  "data": { "label": "Aguardar 1 dia", "quantidade": 1, "unidade": "dias" }
}

ESTRUTURA CONDIÇÃO:
{
  "id": "n4",
  "type": "condicao",
  "position": { "x": 300, "y": 530 },
  "data": { "label": "Tem WhatsApp?", "campo": "whatsapp", "operador": "existe", "valor": "" }
}

ESTRUTURA TAG:
{
  "id": "n5",
  "type": "tag",
  "position": { "x": 300, "y": 690 },
  "data": { "label": "Tag: interessado", "tag": "interessado" }
}

ESTRUTURA AGENTE IA:
{
  "id": "n6",
  "type": "agente_ia",
  "position": { "x": 300, "y": 850 },
  "data": { "label": "Agente SDR", "instrucoes": "Qualifique o lead e agende uma demonstração" }
}

ESTRUTURA EDGE (conexão simples):
{ "id": "e1-2", "source": "n1", "target": "n2" }

EDGE DE CONDIÇÃO (use sourceHandle "sim" ou "nao"):
{ "id": "e4-5", "source": "n4", "target": "n5", "sourceHandle": "sim" }
{ "id": "e4-6", "source": "n4", "target": "n6", "sourceHandle": "nao" }

Use variáveis dinâmicas nos textos: {nome}, {email}, {whatsapp}, {origem}
Escreva mensagens em português brasileiro, profissionais e persuasivas.
Inclua emojis nas mensagens para humanizar.`

export async function POST(req: NextRequest) {
  const { descricao, trigger_tipo } = await req.json()
  if (!descricao) return NextResponse.json({ error: 'descricao required' }, { status: 400 })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Crie um fluxo de cadência para: "${descricao}"
Gatilho: ${trigger_tipo || 'manual'}
Gere entre 5 e 12 nós. Inclua mensagens de aquecimento, conteúdo de valor e CTA.
Retorne APENAS o JSON: { "nodes": [...], "edges": [...] }`,
      },
    ],
  })

  const raw = completion.choices[0].message.content ?? '{}'
  try {
    // Strip potential markdown code blocks
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'IA retornou JSON inválido', raw }, { status: 422 })
  }
}

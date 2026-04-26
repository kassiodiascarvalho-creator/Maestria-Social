import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from '@/lib/builder/blocks'
import { createOpenAIClient, MODEL } from '@/lib/openai'

export async function POST(req: NextRequest) {
  const { prompt, contexto } = await req.json() as { prompt: string; contexto?: string }

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt é obrigatório' }, { status: 400 })
  }

  let openai: Awaited<ReturnType<typeof createOpenAIClient>>
  try {
    openai = await createOpenAIClient()
  } catch {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada no Supabase ou Vercel' }, { status: 503 })
  }

  const systemPrompt = `Você é um especialista em design de landing pages de alta conversão.
Crie a estrutura JSON de uma página web com base no pedido do usuário.

Retorne SOMENTE um JSON válido (sem markdown, sem \`\`\`) com este formato:
{
  "nome": "Nome da página",
  "conteudo": [ array de blocos ],
  "configuracoes": { "primaryColor": "#hex", "backgroundColor": "#hex", "fontFamily": "Inter" }
}

Tipos de blocos disponíveis e seus props:
1. hero: { title, subtitle, description, ctaText, ctaUrl, ctaSecondaryText, ctaSecondaryUrl, alignment, backgroundType, backgroundColor, backgroundImage, textColor, overlayOpacity, minHeight, eyebrow }
2. heading: { text, level, alignment, color, fontSize, fontWeight }
3. text: { content, alignment, color, fontSize, maxWidth }
4. button: { text, url, variant, size, alignment, backgroundColor, textColor, borderRadius }
5. image: { src, alt, caption, borderRadius, maxWidth, alignment, shadow }
6. video: { url, title, aspectRatio, borderRadius }
7. spacer: { height }
8. divider: { style, color, thickness }
9. features: { title, subtitle, items: [{icon, title, description, color}], columns, style }
10. testimonial: { quote, author, role, avatar, company, rating, backgroundColor, textColor }
11. stats: { items: [{value, label, prefix, suffix}], columns, backgroundColor, textColor, accentColor }
12. capture-form: { title, subtitle, ctaText, fields: [{name, label, type, placeholder, required}], successMessage, backgroundColor }
13. accordion: { title, items: [{question, answer}] }
14. gallery: { images: [{src, alt, caption}], columns, gap, borderRadius }
15. countdown: { targetDate, title, backgroundColor, textColor, accentColor }
16. badge: { text, icon, backgroundColor, textColor, size }
17. cta-section: { title, description, ctaText, ctaUrl, secondaryCta, backgroundColor, textColor }
18. social-proof: { title, logos: [{src, alt, url}], style }
19. timeline: { title, items: [{step, title, description, icon}] }
20. pricing: { title, subtitle, plans: [{name, price, period, description, features: [], ctaText, ctaUrl, highlighted}] }

REGRAS OBRIGATÓRIAS:
- Use EXATAMENTE os nomes de tipo listados acima (ex: "hero", "features", "capture-form")
- Crie páginas completas com 6-15 blocos
- Landing page: hero → features → stats → testimonial → pricing → cta-section
- Capture page: hero → features → capture-form → social-proof
- Textos em português brasileiro, conteúdo real e convincente
- Imagens do Unsplash: https://images.unsplash.com/photo-ID?w=800&q=80
- IDs dos blocos: strings de 8 chars aleatórias (ex: "a1b2c3d4")
- Retorne JSON puro, sem blocos de código markdown
${contexto ? `\nContexto adicional: ${contexto}` : ''}`

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    })

    const text = completion.choices[0]?.message?.content || ''

    let parsed: { nome?: string; conteudo?: unknown[]; configuracoes?: Record<string, unknown> }
    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({
        error: `IA retornou formato inválido. Resposta recebida: "${text.slice(0, 150)}..."`,
      }, { status: 500 })
    }

    const conteudo = (parsed.conteudo ?? []).map((b: unknown) => {
      const block = b as Record<string, unknown>
      return { ...block, id: nanoid() }
    })

    return NextResponse.json({
      nome: parsed.nome ?? 'Nova Página',
      conteudo,
      configuracoes: parsed.configuracoes ?? {},
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

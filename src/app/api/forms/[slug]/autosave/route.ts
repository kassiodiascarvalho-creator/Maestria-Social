import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { slug } = await params
  const db = createAdminClient() as any

  const body = await req.json().catch(() => ({}))
  const { response_id, respostas } = body as {
    response_id?: string
    respostas?: { question_id: string; valor: string }[]
  }

  if (!response_id || !respostas?.length) return NextResponse.json({ ok: false })

  // Verifica que o response pertence a este form
  const { data: form } = await db.from('forms').select('id').eq('slug', slug).maybeSingle()
  if (!form) return NextResponse.json({ ok: false })

  const { data: resp } = await db
    .from('form_responses')
    .select('id')
    .eq('id', response_id)
    .eq('form_id', form.id)
    .maybeSingle()
  if (!resp) return NextResponse.json({ ok: false })

  // Salva respostas preenchidas (upsert via delete + insert)
  const comValor = respostas.filter(r => r.question_id && r.valor?.trim())
  if (comValor.length > 0) {
    const questionIds = comValor.map(r => r.question_id)
    await db.from('form_answers').delete().eq('response_id', response_id).in('question_id', questionIds)
    await db.from('form_answers').insert(comValor.map(r => ({
      response_id, question_id: r.question_id, valor: r.valor,
    })))
  }

  // Atualiza completude parcial
  const completude = Math.round((comValor.length / respostas.length) * 100)
  await db.from('form_responses').update({ completude }).eq('id', response_id)

  return NextResponse.json({ ok: true })
}

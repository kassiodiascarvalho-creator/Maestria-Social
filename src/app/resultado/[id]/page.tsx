import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ResultadoCompleto from './ResultadoCompleto'

const SITE_URL = 'https://maestriasocial.com'

const NOME_PARA_KEY: Record<string, string> = {
  Sociabilidade: 'A',
  Comunicação: 'B',
  Relacionamento: 'C',
  Persuasão: 'D',
  Influência: 'E',
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('nome,qs_total,nivel_qs,pilar_fraco')
    .eq('id', id)
    .single()

  if (!lead || !lead.qs_total) {
    return {
      title: 'Resultado · Maestria Social',
      description: 'Descubra seu Quociente Social',
    }
  }

  const titulo = `${lead.nome}: ${lead.qs_total}/250 no Quociente Social — Nível ${lead.nivel_qs}`
  const descricao = `Pilar mais fraco: ${lead.pilar_fraco}. Faça você também o teste e descubra seu QS.`
  const ogImage = `${SITE_URL}/api/og/resultado/${id}`

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'website',
      url: `${SITE_URL}/resultado/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descricao,
      images: [ogImage],
    },
  }
}

async function gerarWhatsappLink(lead: {
  nome: string;
  qs_total: number;
  nivel_qs: string;
  pilar_fraco: string;
  scores: Record<string, number>;
}): Promise<string> {
  try {
    const numeroDestino = (await getConfig('META_WHATSAPP_NUMBER')) || '5533984522635'
    const keyPilar = NOME_PARA_KEY[lead.pilar_fraco ?? ''] ?? 'B'
    const scorePilar = lead.scores[keyPilar] ?? 0
    const percentualPilar = Math.round((scorePilar / 50) * 100)
    const texto = [
      `Oi, fiz o Teste de Quociente Social e meu resultado foi ${lead.qs_total}/250 — ${lead.nivel_qs}.`,
      `Meu pilar mais fraco é ${lead.pilar_fraco} com ${percentualPilar}%.`,
      'Quero entender meu próximo passo.',
    ].join(' ')
    const num = numeroDestino.replace(/\D/g, '')
    return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
  } catch {
    return ''
  }
}

export default async function ResultadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const fromQuiz = from === 'quiz'

  const supabase = createAdminClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('nome,qs_total,qs_percentual,nivel_qs,pilar_fraco,scores')
    .eq('id', id)
    .single()

  if (!lead || !lead.qs_total) notFound()

  const scores = (lead.scores ?? {}) as Record<string, number>

  const leadResult = {
    nome: lead.nome as string,
    qs_total: lead.qs_total as number,
    qs_percentual: lead.qs_percentual as number,
    nivel_qs: lead.nivel_qs as string,
    pilar_fraco: lead.pilar_fraco as string,
    scores,
  }

  const whatsappLink = fromQuiz
    ? await gerarWhatsappLink(leadResult)
    : undefined

  return (
    <ResultadoCompleto
      lead={leadResult}
      leadId={id}
      fromQuiz={fromQuiz}
      whatsappLink={whatsappLink}
    />
  )
}

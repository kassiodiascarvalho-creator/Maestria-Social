import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import BaixarImagem from './BaixarImagem'

const PILARES = [
  { key: 'A', name: 'Sociabilidade' },
  { key: 'B', name: 'Comunicação' },
  { key: 'C', name: 'Relacionamento' },
  { key: 'D', name: 'Persuasão' },
  { key: 'E', name: 'Influência' },
]

const SITE_URL = 'https://maestriasocial.com'

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

export default async function ResultadoPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('nome,qs_total,qs_percentual,nivel_qs,pilar_fraco,scores')
    .eq('id', id)
    .single()

  if (!lead || !lead.qs_total) notFound()

  const scores = (lead.scores ?? {}) as Record<string, number>
  const ogImage = `/api/og/resultado/${id}`

  return (
    <>
      <style>{css}</style>
      <main className="r-wrap">
        <div className="r-card">
          <div className="r-header">
            <span className="r-diamond">◆</span>
            <span className="r-brand">Maestria Social</span>
          </div>

          <p className="r-name">{lead.nome}</p>
          <h1 className="r-title">Quociente Social</h1>

          <div className="r-score">
            <span className="r-score-num">{lead.qs_total}</span>
            <span className="r-score-den">/250</span>
          </div>
          <p className="r-nivel">Nível {lead.nivel_qs} · {lead.qs_percentual}%</p>

          {lead.pilar_fraco && (
            <p className="r-pilar">Pilar com maior oportunidade: <strong>{lead.pilar_fraco}</strong></p>
          )}

          <div className="r-pilares">
            {PILARES.map((p) => {
              const score = scores[p.key] ?? 0
              const pct = Math.round((score / 50) * 100)
              const isFraco = lead.pilar_fraco === p.name
              return (
                <div key={p.key} className={`r-pilar-row${isFraco ? ' is-fraco' : ''}`}>
                  <div className="r-pilar-info">
                    <span className="r-pilar-name">{p.name}</span>
                    <span className="r-pilar-pct">{pct}%</span>
                  </div>
                  <div className="r-pilar-bar">
                    <div className="r-pilar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Imagem do resultado para download */}
          <div className="r-image-wrap">
            <p className="r-image-label">Imagem para compartilhar</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ogImage} alt={`Resultado de ${lead.nome}`} className="r-image" />
            <BaixarImagem url={ogImage} nome={lead.nome} />
          </div>

          <div className="r-cta-block">
            <p className="r-cta-text">Quer descobrir o seu?</p>
            <Link href="/" className="r-cta-btn">
              Fazer o teste agora →
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}

const css = `
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0e0f09; color: #fff9e6; font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; }
  .r-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px 20px; }
  .r-card { width: 100%; max-width: 680px; background: #1a1410; border: 1px solid #2a1f18; border-radius: 22px; padding: 44px 36px; position: relative; overflow: hidden; }
  .r-card::before { content: ''; position: absolute; top: -120px; right: -120px; width: 320px; height: 320px; background: radial-gradient(circle, rgba(194,144,77,.1) 0%, transparent 65%); pointer-events: none; }
  .r-header { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
  .r-diamond { font-size: 8px; color: #c2904d; }
  .r-brand { font-size: 11px; color: #c2904d; letter-spacing: 4px; text-transform: uppercase; font-weight: 700; }
  .r-name { font-size: 14px; color: #7a6e5e; margin-bottom: 6px; }
  .r-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 38px; font-style: italic; color: #fff9e6; margin-bottom: 18px; }
  .r-score { display: flex; align-items: baseline; gap: 6px; }
  .r-score-num { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 96px; font-weight: 700; color: #c2904d; line-height: 1; }
  .r-score-den { font-size: 22px; color: #7a6e5e; }
  .r-nivel { font-size: 16px; color: #fff9e6; margin-top: 6px; margin-bottom: 8px; }
  .r-pilar { font-size: 13px; color: #7a6e5e; margin-bottom: 28px; }
  .r-pilar strong { color: #c2904d; }
  .r-pilares { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
  .r-pilar-row { display: flex; flex-direction: column; gap: 4px; }
  .r-pilar-info { display: flex; justify-content: space-between; }
  .r-pilar-name { font-size: 13px; color: #7a6e5e; }
  .r-pilar-pct { font-size: 13px; color: #7a6e5e; font-weight: 600; }
  .r-pilar-bar { height: 4px; background: #2a1f18; border-radius: 99px; overflow: hidden; }
  .r-pilar-fill { height: 100%; background: #3d3328; border-radius: 99px; }
  .r-pilar-row.is-fraco .r-pilar-name,
  .r-pilar-row.is-fraco .r-pilar-pct { color: #c2904d; font-weight: 700; }
  .r-pilar-row.is-fraco .r-pilar-fill { background: linear-gradient(90deg, #c2904d, #fee69d); }
  .r-image-wrap { margin: 28px 0; padding: 16px; background: rgba(255,255,255,.02); border: 1px solid #2a1f18; border-radius: 14px; }
  .r-image-label { font-size: 11px; color: #4a3e30; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; margin-bottom: 12px; }
  .r-image { width: 100%; height: auto; border-radius: 8px; border: 1px solid #2a1f18; display: block; }
  .r-download { display: inline-block; margin-top: 12px; font-size: 13px; color: #c2904d; text-decoration: none; font-weight: 600; background: none; border: none; cursor: pointer; font-family: inherit; padding: 0; }
  .r-download:hover { text-decoration: underline; }
  .r-download:disabled { opacity: .6; cursor: default; }
  .r-cta-block { text-align: center; padding-top: 24px; border-top: 1px solid #2a1f18; }
  .r-cta-text { font-size: 14px; color: #7a6e5e; margin-bottom: 14px; }
  .r-cta-btn { display: inline-block; background: linear-gradient(135deg, #c2904d, #d4a055); color: #0e0f09; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 12px; }
  .r-cta-btn:hover { filter: brightness(1.08); }
`

import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const PILARES = [
  { key: 'A', name: 'Sociabilidade' },
  { key: 'B', name: 'Comunicação' },
  { key: 'C', name: 'Relacionamento' },
  { key: 'D', name: 'Persuasão' },
  { key: 'E', name: 'Influência' },
]

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const fallback = (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#0e0f09',
        color: '#fff9e6',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 48,
        fontFamily: 'serif',
      }}
    >
      Maestria Social
    </div>
  )

  try {
    const supabase = createAdminClient()
    const { data: lead, error } = await supabase
      .from('leads')
      .select('nome,qs_total,qs_percentual,nivel_qs,pilar_fraco,scores')
      .eq('id', id)
      .single()

    if (error || !lead || !lead.qs_total) {
      return new ImageResponse(fallback, { width: 1200, height: 630 })
    }

    const scores = (lead.scores ?? {}) as Record<string, number>

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: '#0e0f09',
            color: '#fff9e6',
            padding: '60px 70px',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Glow */}
          <div
            style={{
              position: 'absolute',
              top: -200,
              right: -200,
              width: 600,
              height: 600,
              background: 'radial-gradient(circle, rgba(194,144,77,0.18) 0%, transparent 65%)',
              display: 'flex',
            }}
          />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 30 }}>
            <div style={{ fontSize: 14, color: '#c2904d', letterSpacing: 4 }}>◆</div>
            <div style={{ fontSize: 16, color: '#c2904d', letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>
              Maestria Social
            </div>
          </div>

          {/* Nome */}
          <div style={{ display: 'flex', fontSize: 28, color: '#7a6e5e', marginBottom: 12 }}>
            {lead.nome}
          </div>

          {/* Título */}
          <div style={{ display: 'flex', fontSize: 52, color: '#fff9e6', marginBottom: 24, fontWeight: 300 }}>
            Quociente Social
          </div>

          {/* Pontuação */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 160, fontWeight: 700, color: '#c2904d', lineHeight: 1 }}>
              {lead.qs_total}
            </div>
            <div style={{ fontSize: 40, color: '#7a6e5e' }}>/250</div>
          </div>

          {/* Nível */}
          <div style={{ display: 'flex', fontSize: 32, color: '#fff9e6', marginBottom: 36 }}>
            Nível {lead.nivel_qs} · {lead.qs_percentual}%
          </div>

          {/* Pilares */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PILARES.map((p) => {
              const score = scores[p.key] ?? 0
              const pct = Math.round((score / 50) * 100)
              const isFraco = lead.pilar_fraco === p.name
              return (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', fontSize: 18, color: isFraco ? '#c2904d' : '#7a6e5e', width: 200, fontWeight: isFraco ? 700 : 400 }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', flex: 1, height: 8, background: '#2a1f18', borderRadius: 99, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: isFraco ? '#c2904d' : '#3d3328',
                        display: 'flex',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', fontSize: 18, color: isFraco ? '#c2904d' : '#7a6e5e', width: 50, justifyContent: 'flex-end', fontWeight: isFraco ? 700 : 400 }}>
                    {pct}%
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', position: 'absolute', bottom: 32, right: 70, fontSize: 16, color: '#7a6e5e', letterSpacing: 1 }}>
            maestriasocial.com
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch (err) {
    console.error('[og/resultado]', err)
    return new ImageResponse(fallback, { width: 1200, height: 630 })
  }
}

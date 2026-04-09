import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Trim obrigatório: NEXT_PUBLIC_SUPABASE_URL pode ter \n no final
const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://dhudmbbgdyxdxypixyis.supabase.co'
).trim()

const PILARES = [
  { key: 'A', name: 'Sociabilidade' },
  { key: 'B', name: 'Comunicação' },
  { key: 'C', name: 'Relacionamento' },
  { key: 'D', name: 'Persuasão' },
  { key: 'E', name: 'Influência' },
]

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
      fontFamily: 'sans-serif',
    }}
  >
    Maestria Social
  </div>
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const debug = new URL(req.url).searchParams.get('debug') === '1'

  try {
    // No edge runtime, SUPABASE_SERVICE_ROLE_KEY não está disponível;
    // usamos a anon key que tem leitura pública dos leads.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!key) {
      if (debug) return Response.json({ erro: 'Nenhuma chave disponível' })
      return new ImageResponse(fallback, { width: 1200, height: 630 })
    }

    const url = `${SUPABASE_URL}/rest/v1/leads?id=eq.${id}&select=nome,qs_total,qs_percentual,nivel_qs,pilar_fraco,scores&limit=1`

    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      if (debug) return Response.json({ erro: 'Supabase erro', status: res.status, url, body: await res.text() })
      return new ImageResponse(fallback, { width: 1200, height: 630 })
    }

    const rows = await res.json() as unknown[]
    const lead = Array.isArray(rows) && rows.length > 0
      ? rows[0] as { nome: string; qs_total: number; qs_percentual: number; nivel_qs: string; pilar_fraco: string; scores: Record<string, number> }
      : null

    if (!lead?.qs_total) {
      if (debug) return Response.json({ erro: 'lead não encontrado ou sem qs_total', rows, url })
      return new ImageResponse(fallback, { width: 1200, height: 630 })
    }

    if (debug) return Response.json({ ok: true, lead, url, keyInicio: key.substring(0, 10) })

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
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 30 }}>
            <div style={{ fontSize: 16, color: '#c2904d', letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>◆ Maestria Social</div>
          </div>

          {/* Nome */}
          <div style={{ display: 'flex', fontSize: 28, color: '#7a6e5e', marginBottom: 12 }}>{lead.nome}</div>

          {/* Título */}
          <div style={{ display: 'flex', fontSize: 52, color: '#fff9e6', marginBottom: 24, fontWeight: 300 }}>Quociente Social</div>

          {/* Pontuação */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 160, fontWeight: 700, color: '#c2904d', lineHeight: '1' }}>{lead.qs_total}</div>
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
                  <div style={{ display: 'flex', fontSize: 18, color: isFraco ? '#c2904d' : '#7a6e5e', width: 200, fontWeight: isFraco ? 700 : 400 }}>{p.name}</div>
                  <div style={{ display: 'flex', flexGrow: 1, height: 8, background: '#2a1f18', borderRadius: '99px' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: isFraco ? '#c2904d' : '#3d3328', display: 'flex', borderRadius: '99px' }} />
                  </div>
                  <div style={{ display: 'flex', fontSize: 18, color: isFraco ? '#c2904d' : '#7a6e5e', width: 50, justifyContent: 'flex-end', fontWeight: isFraco ? 700 : 400 }}>{pct}%</div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', marginTop: 'auto', fontSize: 16, color: '#7a6e5e' }}>maestriasocial.com</div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch (err) {
    console.error('[og/resultado]', err)
    if (debug) return Response.json({ erro: String(err) })
    return new ImageResponse(fallback, { width: 1200, height: 630 })
  }
}

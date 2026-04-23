import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

// GET /api/admin/wpp/baileys-job?jobId=xxx — consulta progresso de um job de disparo
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const jobId = req.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId obrigatório' }, { status: 400 })

  const apiUrl = await getConfig('BAILEYS_API_URL')
  if (!apiUrl) return NextResponse.json({ error: 'BAILEYS_API_URL não configurada' }, { status: 400 })

  const base = apiUrl.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/job/${jobId}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ error: data.error || 'Erro ao consultar job' }, { status: res.status })
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'Servidor Baileys offline ou inacessível' }, { status: 502 })
  }
}

// POST — pausa ou retoma um job de disparo no servidor Baileys
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { jobId, acao } = await req.json()
  if (!jobId || !['pause', 'resume'].includes(acao)) {
    return NextResponse.json({ error: 'jobId e acao (pause|resume) são obrigatórios' }, { status: 400 })
  }

  const apiUrl = await getConfig('BAILEYS_API_URL')
  if (!apiUrl) return NextResponse.json({ error: 'BAILEYS_API_URL não configurada' }, { status: 400 })

  const base = apiUrl.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/job/${jobId}/${acao}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return NextResponse.json({ error: data.error || `Falha ao ${acao === 'pause' ? 'pausar' : 'retomar'} job` }, { status: res.status })
    }
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: true, status: data.status ?? (acao === 'pause' ? 'pausado' : 'rodando') })
  } catch {
    return NextResponse.json({ error: 'Servidor Baileys offline ou inacessível' }, { status: 502 })
  }
}

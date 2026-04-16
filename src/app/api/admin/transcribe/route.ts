import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import { transcreverAudio } from '@/lib/transcribe'

export const dynamic = 'force-dynamic'

/**
 * Endpoint de transcrição de áudio via Whisper.
 * Chamado pelo servidor Baileys quando recebe mensagens de áudio/voz.
 * Autenticado via x-baileys-secret (mesmo secret do webhook).
 */
export async function POST(req: NextRequest) {
  const secret = await getConfig('AGENT_BAILEYS_SECRET')
  if (secret) {
    const headerSecret = req.headers.get('x-baileys-secret')
    if (headerSecret !== secret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  }

  let body: { audio?: string; mimetype?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { audio, mimetype } = body
  if (!audio) return NextResponse.json({ error: 'Campo audio obrigatório' }, { status: 400 })

  const texto = await transcreverAudio(audio, mimetype || 'audio/ogg')
  if (!texto) return NextResponse.json({ error: 'Falha na transcrição' }, { status: 500 })

  return NextResponse.json({ texto })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const pessoaId = req.nextUrl.searchParams.get('pessoaId')
  if (!pessoaId) return NextResponse.json({ error: 'pessoaId obrigatório' }, { status: 400 })

  const clientId = await getConfig('GOOGLE_CLIENT_ID')
  const appUrl = await getConfig('APP_URL') || process.env.NEXT_PUBLIC_APP_URL || ''

  if (!clientId) return NextResponse.json({ error: 'GOOGLE_CLIENT_ID não configurado' }, { status: 500 })

  const redirectUri = `${appUrl}/api/agenda/google/callback`
  const scope = 'https://www.googleapis.com/auth/calendar.events'

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scope)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', pessoaId)

  return NextResponse.redirect(url.toString())
}

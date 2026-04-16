import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const pessoaId = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  const appUrl = await getConfig('APP_URL') || process.env.NEXT_PUBLIC_APP_URL || ''

  if (error || !code || !pessoaId) {
    return NextResponse.redirect(`${appUrl}/dashboard/agenda/${pessoaId ?? ''}?google=erro`)
  }

  const clientId = await getConfig('GOOGLE_CLIENT_ID')
  const clientSecret = await getConfig('GOOGLE_CLIENT_SECRET')
  const redirectUri = `${appUrl}/api/agenda/google/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard/agenda/${pessoaId}?google=sem_config`)
  }

  // Troca code por tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('[google/callback] Erro ao trocar code:', await tokenRes.text())
    return NextResponse.redirect(`${appUrl}/dashboard/agenda/${pessoaId}?google=erro`)
  }

  const tokens = await tokenRes.json() as { refresh_token?: string }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${appUrl}/dashboard/agenda/${pessoaId}?google=sem_refresh`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  await admin
    .from('agenda_pessoas')
    .update({ google_refresh_token: tokens.refresh_token })
    .eq('id', pessoaId)

  return NextResponse.redirect(`${appUrl}/dashboard/agenda/${pessoaId}?google=ok`)
}

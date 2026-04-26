import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const COOKIE = 'paginas_sid'
const TOKEN = 'b4cc9e1f-paginas-ok-7d3a'

export async function POST(req: NextRequest) {
  const { senha } = await req.json() as { senha: string }
  if (!senha) return NextResponse.json({ error: 'Senha obrigatória' }, { status: 400 })

  const hash = createHash('sha256').update(senha).digest('hex')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any
  const { data } = await db
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'PAGINAS_SENHA_HASH')
    .single()

  if (!data || data.valor !== hash) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/dashboard/paginas',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE)
  return res
}

export function verificarCookie(req: NextRequest): boolean {
  return req.cookies.get('paginas_sid')?.value === TOKEN
}

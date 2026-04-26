import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getConfig } from '@/lib/config'

const COOKIE = 'paginas_sid'
const TOKEN = 'b4cc9e1f-paginas-ok-7d3a'

export async function POST(req: NextRequest) {
  const { senha } = await req.json() as { senha: string }
  if (!senha) return NextResponse.json({ error: 'Senha obrigatória' }, { status: 400 })

  const hash = createHash('sha256').update(senha.trim(), 'utf8').digest('hex')

  const stored = await getConfig('PAGINAS_SENHA_HASH')
  if (!stored) {
    return NextResponse.json({ error: 'Configuração não encontrada — rode o SQL no Supabase.' }, { status: 503 })
  }

  if (stored.trim().toLowerCase() !== hash.toLowerCase()) {
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

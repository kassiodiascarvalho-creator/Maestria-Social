'use server'

import { cookies } from 'next/headers'

const SENHA = 'Pxg9A}si+{qkBA,~&wlTAO^-59q['

export async function verificarSenha(senha: string): Promise<{ ok: boolean }> {
  if (senha === SENHA) {
    const jar = await cookies()
    jar.set('ds-auth', 'ok', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24h
      path: '/',
    })
    return { ok: true }
  }
  return { ok: false }
}

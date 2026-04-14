import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

async function checkAuth(): Promise<boolean> {
  const jar = await cookies()
  return jar.get('ds-auth')?.value === 'ok'
}

export async function HEAD(_req: NextRequest) {
  if (!(await checkAuth())) {
    return new NextResponse(null, { status: 401 })
  }
  return new NextResponse(null, { status: 200 })
}

export async function GET(_req: NextRequest) {
  if (!(await checkAuth())) {
    return new NextResponse('Não autorizado', { status: 401 })
  }

  try {
    const filePath = path.join(process.cwd(), 'design-spec.html')
    const html = fs.readFileSync(filePath, 'utf-8')
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch {
    return new NextResponse('Arquivo não encontrado', { status: 404 })
  }
}

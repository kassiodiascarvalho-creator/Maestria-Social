import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type P = { params: Promise<{ logId: string }> }

export async function GET(_req: NextRequest, { params }: P) {
  const { logId } = await params
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: log } = await db
    .from('email_logs').select('email').eq('id', logId).single()

  if (log?.email) {
    await db.from('email_lista_contatos')
      .update({ status: 'descadastrado' })
      .eq('email', log.email)
    await db.from('email_eventos')
      .insert({ log_id: logId, tipo: 'aberto' }) // registra ação
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Descadastrado</title>
    <style>body{font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
    .box{text-align:center;padding:48px;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,.08);max-width:420px;}
    h1{font-size:24px;color:#111;margin:0 0 12px;}p{color:#666;font-size:15px;line-height:1.6;margin:0;}</style>
    </head><body><div class="box">
    <div style="font-size:48px;margin-bottom:16px">✅</div>
    <h1>Descadastrado com sucesso</h1>
    <p>Você não receberá mais e-mails desta lista.<br>Caso tenha sido por engano, entre em contato conosco.</p>
    </div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}

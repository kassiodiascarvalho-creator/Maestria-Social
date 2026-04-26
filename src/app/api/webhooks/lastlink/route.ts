import { NextRequest, NextResponse } from 'next/server'
import { processarCompra } from '@/lib/vendas'
import { getConfig } from '@/lib/config'

export async function POST(req: NextRequest) {
  const body = await req.text()
  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validação de token Lastlink (configure LASTLINK_TOKEN no Supabase/Vercel)
  const token = await getConfig('LASTLINK_TOKEN')
  if (token) {
    const received = req.headers.get('x-lastlink-token') || req.headers.get('authorization')?.replace('Bearer ', '') || req.nextUrl.searchParams.get('token') || ''
    if (received && received !== token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
  }

  const event = (payload.event as string) || (payload.status as string) || ''
  const customer = (payload.customer as Record<string, unknown>) || (payload.buyer as Record<string, unknown>) || {}
  const product = (payload.product as Record<string, unknown>) || {}
  const order = (payload.order as Record<string, unknown>) || {}
  const tracking = (payload.tracking as Record<string, unknown>) || {}

  const statusMap: Record<string, string> = {
    payment_confirmed: 'aprovado', approved: 'aprovado', paid: 'aprovado',
    payment_refunded: 'reembolsado', refunded: 'reembolsado',
    payment_chargeback: 'chargeback', chargeback: 'chargeback',
    payment_canceled: 'cancelado', canceled: 'cancelado', cancelled: 'cancelado',
    payment_pending: 'pendente', pending: 'pendente', waiting: 'pendente',
  }
  const status = statusMap[event.toLowerCase()]
  if (!status) return NextResponse.json({ ok: true, ignorado: event })

  const email = (customer.email as string) || (payload.email as string) || ''
  if (!email) return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })

  const rawValor = (order.amount as number | string) || (payload.amount as number | string) || 0
  const valor = typeof rawValor === 'number'
    ? rawValor > 100 ? rawValor / 100 : rawValor
    : parseFloat(String(rawValor).replace(',', '.'))

  const result = await processarCompra({
    plataforma: 'lastlink',
    email,
    nome: (customer.name as string) || (customer.full_name as string) || '',
    fone: (customer.phone as string) || (customer.whatsapp as string) || '',
    produto_nome: (product.name as string) || (payload.product_name as string) || '',
    produto_id: String(product.id || payload.product_id || ''),
    valor: isNaN(valor) ? 0 : valor,
    moeda: 'BRL',
    status,
    transaction_id: (order.id as string) || (payload.transaction_id as string) || (payload.order_id as string) || '',
    utm_source: (tracking.utm_source as string) || (payload.utm_source as string) || '',
    utm_medium: (tracking.utm_medium as string) || (payload.utm_medium as string) || '',
    utm_campaign: (tracking.utm_campaign as string) || (payload.utm_campaign as string) || '',
    dados_raw: payload,
  })

  return NextResponse.json(result)
}

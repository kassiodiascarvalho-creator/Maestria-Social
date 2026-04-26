import { NextRequest, NextResponse } from 'next/server'
import { processarCompra } from '@/lib/vendas'
import { getConfig } from '@/lib/config'

export async function POST(req: NextRequest) {
  const body = await req.text()
  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validação do token Kiwify (opcional — configure KIWIFY_TOKEN no Supabase/Vercel)
  const token = await getConfig('KIWIFY_TOKEN')
  if (token) {
    const received = req.headers.get('kiwify-token') || req.nextUrl.searchParams.get('token') || ''
    if (received && received !== token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
  }

  const orderStatus = (payload.order_status as string) || ''
  const customer = (payload.customer as Record<string, unknown>) || {}
  const product = (payload.product as Record<string, unknown>) || {}
  const order = (payload.order as Record<string, unknown>) || {}
  const tracking = (payload.trackingParameters as Record<string, unknown>) || {}

  const statusMap: Record<string, string> = {
    paid: 'aprovado', approved: 'aprovado',
    refunded: 'reembolsado', chargedback: 'chargeback',
    cancelled: 'cancelado', canceled: 'cancelado',
    waiting_payment: 'pendente',
  }
  const status = statusMap[orderStatus.toLowerCase()]
  if (!status) return NextResponse.json({ ok: true, ignorado: orderStatus })

  const email = (customer.email as string) || ''
  if (!email) return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })

  const valor = parseFloat(String(order.total_price || order.amount || 0).replace(',', '.'))

  const result = await processarCompra({
    plataforma: 'kiwify',
    email,
    nome: (customer.full_name as string) || (customer.name as string) || '',
    fone: (customer.mobile as string) || (customer.phone as string) || '',
    produto_nome: (product.name as string) || '',
    produto_id: String(product.id || ''),
    valor: isNaN(valor) ? 0 : valor,
    moeda: 'BRL',
    status,
    transaction_id: (order.id as string) || '',
    utm_source: (tracking.src as string) || (tracking.utm_source as string) || '',
    utm_medium: (tracking.utm_medium as string) || '',
    utm_campaign: (tracking.utm_campaign as string) || '',
    dados_raw: payload,
  })

  return NextResponse.json(result)
}

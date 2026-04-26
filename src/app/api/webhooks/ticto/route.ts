import { NextRequest, NextResponse } from 'next/server'
import { processarCompra } from '@/lib/vendas'
import { getConfig } from '@/lib/config'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validação de assinatura Ticto (configure TICTO_TOKEN no Supabase/Vercel)
  const token = await getConfig('TICTO_TOKEN')
  if (token) {
    const signature = req.headers.get('x-ticto-signature') || req.headers.get('x-signature') || ''
    const expected = createHmac('sha256', token).update(body).digest('hex')
    if (signature && signature !== expected && !signature.includes(token)) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
  }

  const event = (payload.event as string) || (payload.status as string) || (payload.type as string) || ''
  const data = (payload.data as Record<string, unknown>) || payload
  const customer = (data.customer as Record<string, unknown>) || (data.client as Record<string, unknown>) || {}
  const product = (data.product as Record<string, unknown>) || {}
  const order = (data.order as Record<string, unknown>) || {}
  const utms = (data.tracking as Record<string, unknown>) || (data.utms as Record<string, unknown>) || {}

  const statusMap: Record<string, string> = {
    approved: 'aprovado', paid: 'aprovado', completed: 'aprovado',
    'payment.approved': 'aprovado', 'order.approved': 'aprovado',
    refunded: 'reembolsado', 'payment.refunded': 'reembolsado',
    chargeback: 'chargeback', 'payment.chargeback': 'chargeback',
    canceled: 'cancelado', cancelled: 'cancelado', 'order.canceled': 'cancelado',
    pending: 'pendente', waiting: 'pendente', 'payment.pending': 'pendente',
  }
  const status = statusMap[event.toLowerCase()]
  if (!status) return NextResponse.json({ ok: true, ignorado: event })

  const email = (customer.email as string) || (data.email as string) || ''
  if (!email) return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })

  const rawValor = (order.amount as number) || (order.total as number) || (data.amount as number) || 0
  const valor = rawValor > 1000 ? rawValor / 100 : rawValor

  const result = await processarCompra({
    plataforma: 'ticto',
    email,
    nome: (customer.name as string) || (customer.full_name as string) || '',
    fone: (customer.phone as string) || (customer.whatsapp as string) || '',
    produto_nome: (product.name as string) || (data.product_name as string) || '',
    produto_id: String(product.id || data.product_id || ''),
    valor: isNaN(valor) ? 0 : valor,
    moeda: (order.currency as string) || 'BRL',
    status,
    transaction_id: (order.id as string) || (data.transaction_id as string) || (data.id as string) || '',
    utm_source: (utms.utm_source as string) || (data.utm_source as string) || '',
    utm_medium: (utms.utm_medium as string) || (data.utm_medium as string) || '',
    utm_campaign: (utms.utm_campaign as string) || (data.utm_campaign as string) || '',
    dados_raw: payload,
  })

  return NextResponse.json(result)
}

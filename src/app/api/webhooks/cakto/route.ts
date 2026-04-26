import { NextRequest, NextResponse } from 'next/server'
import { processarCompra } from '@/lib/vendas'
import { getConfig } from '@/lib/config'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validação de assinatura Cakto (configure CAKTO_TOKEN no Supabase/Vercel)
  const token = await getConfig('CAKTO_TOKEN')
  if (token) {
    const signature = req.headers.get('x-cakto-signature') || req.headers.get('x-signature') || ''
    const expected = createHmac('sha256', token).update(body).digest('hex')
    if (signature && signature !== expected && !signature.includes(token)) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
  }

  const event = (payload.event as string) || (payload.type as string) || ''
  const data = (payload.data as Record<string, unknown>) || payload
  const customer = (data.customer as Record<string, unknown>) || (data.buyer as Record<string, unknown>) || {}
  const product = (data.product as Record<string, unknown>) || {}
  const payment = (data.payment as Record<string, unknown>) || {}

  const statusMap: Record<string, string> = {
    'payment.confirmed': 'aprovado', 'payment.approved': 'aprovado',
    'order.paid': 'aprovado', approved: 'aprovado', paid: 'aprovado',
    'payment.refunded': 'reembolsado', refunded: 'reembolsado',
    'payment.chargeback': 'chargeback', chargeback: 'chargeback',
    'payment.canceled': 'cancelado', 'order.canceled': 'cancelado',
    canceled: 'cancelado', cancelled: 'cancelado',
    'payment.pending': 'pendente', pending: 'pendente',
  }
  const status = statusMap[event.toLowerCase()]
  if (!status) return NextResponse.json({ ok: true, ignorado: event })

  const email = (customer.email as string) || (data.email as string) || ''
  if (!email) return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })

  const rawValor = (payment.amount as number) || (data.amount as number) || (data.value as number) || 0
  const valor = rawValor > 1000 ? rawValor / 100 : rawValor

  const result = await processarCompra({
    plataforma: 'cakto',
    email,
    nome: (customer.name as string) || (customer.full_name as string) || '',
    fone: (customer.phone as string) || (customer.whatsapp as string) || '',
    produto_nome: (product.name as string) || (data.product_name as string) || '',
    produto_id: String(product.id || data.product_id || ''),
    valor: isNaN(valor) ? 0 : valor,
    moeda: (payment.currency as string) || 'BRL',
    status,
    transaction_id: (data.id as string) || (data.order_id as string) || (data.transaction_id as string) || '',
    utm_source: (data.utm_source as string) || '',
    utm_medium: (data.utm_medium as string) || '',
    utm_campaign: (data.utm_campaign as string) || '',
    dados_raw: payload,
  })

  return NextResponse.json(result)
}

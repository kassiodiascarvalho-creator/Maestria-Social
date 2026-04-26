import { NextRequest, NextResponse } from 'next/server'
import { processarCompra } from '@/lib/vendas'
import { getConfig } from '@/lib/config'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validação de assinatura Hubla (configure HUBLA_TOKEN no Supabase/Vercel)
  const token = await getConfig('HUBLA_TOKEN')
  if (token) {
    const signature = req.headers.get('x-hubla-signature') || req.headers.get('x-hub-signature-256') || ''
    const expected = `sha256=${createHmac('sha256', token).update(body).digest('hex')}`
    if (signature && signature !== expected) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
  }

  const event = (payload.type as string) || (payload.event as string) || ''
  const data = (payload.data as Record<string, unknown>) || {}
  const customer = (data.customer as Record<string, unknown>) || (data.buyer as Record<string, unknown>) || {}
  const product = (data.product as Record<string, unknown>) || {}
  const payment = (data.payment as Record<string, unknown>) || {}
  const utms = (data.utms as Record<string, unknown>) || {}

  const statusMap: Record<string, string> = {
    'payment.approved': 'aprovado', 'payment.completed': 'aprovado',
    'invoice.paid': 'aprovado', 'sale.approved': 'aprovado',
    'payment.refunded': 'reembolsado', 'invoice.refunded': 'reembolsado',
    'payment.chargeback': 'chargeback',
    'payment.canceled': 'cancelado', 'subscription.canceled': 'cancelado',
    'payment.pending': 'pendente', 'invoice.pending': 'pendente',
  }
  const status = statusMap[event.toLowerCase()]
  if (!status) return NextResponse.json({ ok: true, ignorado: event })

  const email = (customer.email as string) || ''
  if (!email) return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })

  const rawValor = (payment.amount as number) || (data.amount as number) || 0
  const valor = typeof rawValor === 'number' ? rawValor / 100 : parseFloat(String(rawValor).replace(',', '.'))

  const result = await processarCompra({
    plataforma: 'hubla',
    email,
    nome: (customer.name as string) || (customer.full_name as string) || '',
    fone: (customer.phone as string) || (customer.mobile as string) || '',
    produto_nome: (product.name as string) || '',
    produto_id: String(product.id || ''),
    valor: isNaN(valor) ? 0 : valor,
    moeda: (payment.currency as string) || 'BRL',
    status,
    transaction_id: (data.id as string) || (payment.id as string) || '',
    utm_source: (utms.utm_source as string) || '',
    utm_medium: (utms.utm_medium as string) || '',
    utm_campaign: (utms.utm_campaign as string) || '',
    dados_raw: payload,
  })

  return NextResponse.json(result)
}

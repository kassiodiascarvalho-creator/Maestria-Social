import { NextRequest, NextResponse } from 'next/server'
import { processarCompra } from '@/lib/vendas'
import { getConfig } from '@/lib/config'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validação de assinatura (opcional — configure HOTMART_TOKEN no Supabase/Vercel)
  const token = await getConfig('HOTMART_TOKEN')
  if (token) {
    const signature = req.headers.get('x-hotmart-signature') || req.headers.get('x-hotmart-hottok') || ''
    const expected = createHmac('sha256', token).update(body).digest('hex')
    if (signature && signature !== expected && !signature.includes(token)) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
  }

  // Mapeamento de eventos Hotmart
  const event = (payload.event as string) || ''
  const data = (payload.data as Record<string, unknown>) || {}
  const buyer = (data.buyer as Record<string, unknown>) || {}
  const product = (data.product as Record<string, unknown>) || {}
  const purchase = (data.purchase as Record<string, unknown>) || {}
  const price = (purchase.price as Record<string, unknown>) || {}

  const statusMap: Record<string, string> = {
    PURCHASE_COMPLETE: 'aprovado', PURCHASE_APPROVED: 'aprovado',
    PURCHASE_CANCELED: 'cancelado', PURCHASE_REFUNDED: 'reembolsado',
    PURCHASE_CHARGEBACK: 'chargeback', PURCHASE_DISPUTE: 'pendente',
    SUBSCRIPTION_CANCELLATION: 'cancelado',
  }
  const status = statusMap[event]
  if (!status) return NextResponse.json({ ok: true, ignorado: event })

  const email = (buyer.email as string) || ''
  if (!email) return NextResponse.json({ error: 'Email do comprador não encontrado' }, { status: 400 })

  const result = await processarCompra({
    plataforma: 'hotmart',
    email,
    nome: (buyer.name as string) || '',
    fone: (buyer.phone as string) || '',
    produto_nome: (product.name as string) || '',
    produto_id: String(product.id || ''),
    valor: Number(price.value || 0),
    moeda: (price.currency_value as string) || 'BRL',
    status,
    transaction_id: (purchase.transaction as string) || '',
    utm_source: ((purchase as any).tracking?.source_sck as string) || '', // eslint-disable-line @typescript-eslint/no-explicit-any
    dados_raw: payload,
  })

  return NextResponse.json(result)
}

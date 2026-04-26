import { NextRequest, NextResponse } from 'next/server'
import { processarCompra } from '@/lib/vendas'
import { getConfig } from '@/lib/config'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validação de assinatura (configure EDUZZ_TOKEN no Supabase/Vercel)
  const token = await getConfig('EDUZZ_TOKEN')
  if (token) {
    const signature = req.headers.get('x-eduzz-signature') || req.headers.get('x-hub-signature') || ''
    const expected = createHmac('sha256', token).update(body).digest('hex')
    const expectedSha1 = createHmac('sha1', token).update(body).digest('hex')
    if (signature && !signature.includes(expected) && !signature.includes(expectedSha1)) {
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
  }

  // Eduzz envia por form-post às vezes — mas suportamos JSON
  const key = (payload.key as string) || ''
  const sale = (payload.sale as Record<string, unknown>) || {}
  const customer = (payload.customer as Record<string, unknown>) || {}
  const content = (payload.content as Record<string, unknown>) || {}
  const tracking = (payload.tracking as Record<string, unknown>) || {}

  // Evento via `sale_status` ou `key` (tipo do evento)
  const eventKey = (payload.sale_status as string) || (payload.type as string) || key || ''

  const statusMap: Record<string, string> = {
    sale_approved: 'aprovado', approved: 'aprovado',
    payment_approved: 'aprovado', paid: 'aprovado',
    sale_canceled: 'cancelado', canceled: 'cancelado', cancelled: 'cancelado',
    sale_refunded: 'reembolsado', refunded: 'reembolsado', chargeback: 'chargeback',
    sale_chargeback: 'chargeback',
    waiting_payment: 'pendente', pending: 'pendente',
  }
  const status = statusMap[eventKey.toLowerCase()]
  if (!status) return NextResponse.json({ ok: true, ignorado: eventKey })

  const email = (customer.email as string) || (payload.customer_email as string) || ''
  if (!email) return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })

  const rawValor = (sale.sale_amount_win as string) || (sale.sale_amount as string) || (payload.sale_amount as string) || '0'
  const valor = parseFloat(String(rawValor).replace(',', '.'))

  const result = await processarCompra({
    plataforma: 'eduzz',
    email,
    nome: (customer.customer_name as string) || (customer.name as string) || '',
    fone: (customer.customer_cellphone as string) || (customer.phone as string) || '',
    produto_nome: (content.content_title as string) || (payload.product_name as string) || '',
    produto_id: String(content.content_id || payload.product_id || ''),
    valor: isNaN(valor) ? 0 : valor,
    moeda: 'BRL',
    status,
    transaction_id: (sale.sale_id as string) || (payload.sale_id as string) || '',
    utm_source: (tracking.utm_source as string) || '',
    utm_medium: (tracking.utm_medium as string) || '',
    utm_campaign: (tracking.utm_campaign as string) || '',
    dados_raw: payload,
  })

  return NextResponse.json(result)
}

import { NextRequest, NextResponse } from 'next/server'
import { processarCompra } from '@/lib/vendas'
import { getConfig } from '@/lib/config'

export async function POST(req: NextRequest) {
  const body = await req.text()
  let payload: Record<string, unknown>
  try { payload = JSON.parse(body) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // Validação de token Monetizze (configure MONETIZZE_TOKEN no Supabase/Vercel)
  const token = await getConfig('MONETIZZE_TOKEN')
  if (token) {
    const received = req.headers.get('x-monetizze-token') || req.nextUrl.searchParams.get('token') || (payload.token as string) || ''
    if (received && received !== token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
  }

  // Monetizze envia `tipoPostback` como identificador do evento
  const tipoPostback = (payload.tipoPostback as string) || (payload.type as string) || ''
  const comprador = (payload.comprador as Record<string, unknown>) || {}
  const produto = (payload.produto as Record<string, unknown>) || {}
  const venda = (payload.venda as Record<string, unknown>) || {}

  const statusMap: Record<string, string> = {
    sale_approved: 'aprovado', SALE_APPROVED: 'aprovado',
    payment_approved: 'aprovado', approved: 'aprovado',
    '1': 'aprovado', // Monetizze legado
    sale_canceled: 'cancelado', SALE_CANCELED: 'cancelado',
    canceled: 'cancelado', '3': 'cancelado',
    sale_refunded: 'reembolsado', SALE_REFUNDED: 'reembolsado',
    refunded: 'reembolsado', '4': 'reembolsado',
    chargeback: 'chargeback', SALE_CHARGEBACK: 'chargeback', '5': 'chargeback',
    waiting_payment: 'pendente', WAITING_PAYMENT: 'pendente', '2': 'pendente',
  }
  const status = statusMap[tipoPostback]
  if (!status) return NextResponse.json({ ok: true, ignorado: tipoPostback })

  const email = (comprador.email as string) || (payload.email as string) || ''
  if (!email) return NextResponse.json({ error: 'Email não encontrado' }, { status: 400 })

  const rawValor = (venda.valorProduto as string | number) || (payload.valor as string | number) || '0'
  const valor = parseFloat(String(rawValor).replace(',', '.'))

  const result = await processarCompra({
    plataforma: 'monetizze',
    email,
    nome: (comprador.nome as string) || (comprador.name as string) || '',
    fone: (comprador.telefone as string) || (comprador.phone as string) || '',
    produto_nome: (produto.nome as string) || (produto.name as string) || '',
    produto_id: String(produto.codigo || produto.id || ''),
    valor: isNaN(valor) ? 0 : valor,
    moeda: 'BRL',
    status,
    transaction_id: (venda.chaveUnica as string) || (venda.id as string) || (payload.transaction_id as string) || '',
    utm_source: (payload.utm_source as string) || '',
    utm_medium: (payload.utm_medium as string) || '',
    utm_campaign: (payload.utm_campaign as string) || '',
    dados_raw: payload,
  })

  return NextResponse.json(result)
}

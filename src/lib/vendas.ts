import { createAdminClient } from './supabase/admin'
import { getConfig } from './config'

const db = () => createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

interface DadosCompra {
  plataforma: 'hotmart' | 'kiwify' | 'eduzz' | 'monetizze' | 'manual'
  email: string
  nome?: string
  fone?: string
  produto_nome?: string
  produto_id?: string
  valor?: number
  moeda?: string
  status?: string
  transaction_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  dados_raw?: Record<string, unknown>
}

export async function processarCompra(dados: DadosCompra) {
  const client = db()
  const email = dados.email.trim().toLowerCase()

  // 1. Encontra ou cria lead
  let leadId: string | null = null
  const { data: leadExistente } = await client.from('leads').select('id').eq('email', email).maybeSingle()

  if (leadExistente) {
    leadId = leadExistente.id
    // Atualiza para quente e adiciona tag cliente
    await client.from('leads').update({ status: 'quente' }).eq('id', leadId)
  } else if (dados.nome || dados.fone) {
    const { data: novoLead } = await client.from('leads')
      .insert({
        nome: dados.nome || 'Comprador',
        email,
        whatsapp: dados.fone?.replace(/\D/g, '') || null,
        origem: dados.plataforma,
        status: 'quente',
      })
      .select('id').single()
    leadId = novoLead?.id ?? null
  }

  // 2. Registra a venda (upsert por transaction_id para evitar duplicatas)
  const vendaData = {
    lead_id: leadId,
    plataforma: dados.plataforma,
    produto_nome: dados.produto_nome || null,
    produto_id: dados.produto_id || null,
    valor: dados.valor ?? 0,
    moeda: dados.moeda || 'BRL',
    status: dados.status || 'aprovado',
    transaction_id: dados.transaction_id || null,
    comprador_email: email,
    comprador_nome: dados.nome || null,
    comprador_fone: dados.fone || null,
    utm_source: dados.utm_source || null,
    utm_medium: dados.utm_medium || null,
    utm_campaign: dados.utm_campaign || null,
    dados_raw: dados.dados_raw || null,
  }

  const { data: venda } = dados.transaction_id
    ? await client.from('vendas').upsert(vendaData, { onConflict: 'transaction_id' }).select('id').single()
    : await client.from('vendas').insert(vendaData).select('id').single()

  // 3. Adiciona à lista "Clientes" automaticamente
  if (email && dados.status !== 'cancelado' && dados.status !== 'reembolsado') {
    try {
      let { data: listaClientes } = await client.from('email_listas').select('id').eq('nome', '⭐ Clientes').single()
      if (!listaClientes) {
        const { data: novaLista } = await client.from('email_listas')
          .insert({ nome: '⭐ Clientes', descricao: 'Compradores — adicionados automaticamente' })
          .select('id').single()
        listaClientes = novaLista
      }
      if (listaClientes?.id) {
        await client.from('email_lista_contatos').upsert({
          lista_id: listaClientes.id, lead_id: leadId, email,
          nome: dados.nome || null, origem: dados.plataforma, status: 'ativo',
        }, { onConflict: 'lista_id,email' })
      }
    } catch { /* não crítico */ }
  }

  // 4. Notificação WhatsApp para o admin (se configurado)
  if (dados.status === 'aprovado' || !dados.status) {
    try {
      const notifWpp = await getConfig('VENDA_NOTIF_WHATSAPP')
      if (notifWpp) {
        const valor = dados.valor ? `R$ ${dados.valor.toFixed(2).replace('.', ',')}` : ''
        const msg = `🎉 *Nova venda — ${dados.plataforma.toUpperCase()}*\n\n*Produto:* ${dados.produto_nome || 'N/A'}\n*Valor:* ${valor}\n*Comprador:* ${dados.nome || ''} (${email})\n*ID:* ${dados.transaction_id || 'N/A'}`
        const { enviarViaBaileys } = await import('./baileys')
        const { enviarMensagemWhatsApp } = await import('./meta')
        const modo = await getConfig('WHATSAPP_MODE')
        const instanciaId = (await getConfig('BAILEYS_INSTANCIA_ID')) || '1'
        if (modo === 'baileys') await enviarViaBaileys(notifWpp, msg, instanciaId)
        else await enviarMensagemWhatsApp(notifWpp, msg)
      }
    } catch { /* não crítico */ }
  }

  return { ok: true, venda_id: venda?.id, lead_id: leadId }
}

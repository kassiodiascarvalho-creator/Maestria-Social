import { createAdminClient } from '@/lib/supabase/admin'

const LISTA_LEADS_NOME = 'Leads MS'

/**
 * Adiciona um lead à lista "Leads MS" do WhatsApp.
 * Cria a lista se não existir.
 */
export async function adicionarLeadNaListaWpp(leadId: string, nome: string, telefone: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  // Busca ou cria lista de leads
  let { data: lista } = await db
    .from('wpp_listas')
    .select('id')
    .eq('is_leads', true)
    .maybeSingle()

  if (!lista) {
    const { data: nova } = await db
      .from('wpp_listas')
      .insert({ nome: LISTA_LEADS_NOME, is_leads: true })
      .select('id')
      .single()
    lista = nova
  }

  if (!lista) return

  // Verifica se já existe
  const { data: existente } = await db
    .from('wpp_contatos')
    .select('id')
    .eq('lista_id', lista.id)
    .eq('lead_id', leadId)
    .maybeSingle()

  if (existente) return

  await db.from('wpp_contatos').insert({
    lista_id: lista.id,
    lead_id: leadId,
    nome,
    telefone,
  })
}

/**
 * Atualiza o timestamp de última mensagem recebida do contato (janela 24h).
 */
export async function atualizarUltimaMsgUser(telefone: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any

  // Atualiza em TODOS os contatos com esse telefone (pode estar em várias listas)
  const digits = telefone.replace(/\D/g, '')
  const full = digits.startsWith('55') ? digits : `55${digits}`
  const short = full.startsWith('55') ? full.slice(2) : full

  await db
    .from('wpp_contatos')
    .update({ ultima_msg_user: new Date().toISOString() })
    .or(`telefone.eq.${full},telefone.eq.${short},telefone.eq.${digits}`)
}

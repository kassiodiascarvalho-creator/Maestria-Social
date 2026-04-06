import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const checks: Record<string, string> = {}

  const keys = [
    'META_VERIFY_TOKEN',
    'META_ACCESS_TOKEN',
    'META_PHONE_NUMBER_ID',
    'META_WHATSAPP_NUMBER',
    'WHATSAPP_MODE',
    'AGENT_ATIVO',
    'AGENT_MODEL',
    'OPENAI_API_KEY',
    'COEXISTENCIA_WEBHOOK_URL',
    'META_FORWARD_WEBHOOK_URL',
  ]

  for (const key of keys) {
    const val = await getConfig(key)
    if (!val) {
      checks[key] = '❌ NÃO CONFIGURADO'
    } else if (key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET')) {
      checks[key] = `✅ configurado (${val.slice(0, 6)}...)`
    } else {
      checks[key] = `✅ ${val}`
    }
  }

  // Verifica leads cadastrados
  const supabase = createAdminClient()
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })

  const { data: ultimoLead } = await supabase
    .from('leads')
    .select('nome, whatsapp, status_lead, nivel_qs')
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Verifica conversas
  const { count: totalConversas } = await supabase
    .from('conversas')
    .select('id', { count: 'exact', head: true })

  return NextResponse.json({
    configs: checks,
    banco: {
      totalLeads,
      totalConversas,
      ultimoLead: ultimoLead ?? 'nenhum',
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('whatsapp_instancias')
    .select('*')
    .order('criado_em', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { tipo, label, phone, meta_phone_number_id, meta_access_token, meta_waba_id,
    meta_template_name, meta_template_language, principal } = body
  let { baileys_instance_id } = body

  if (!tipo || !label) {
    return NextResponse.json({ error: 'tipo e label são obrigatórios' }, { status: 400 })
  }
  if (tipo === 'meta' && (!meta_phone_number_id || !meta_access_token)) {
    return NextResponse.json({ error: 'meta_phone_number_id e meta_access_token são obrigatórios para tipo meta' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Cria instância no servidor Baileys automaticamente
  if (tipo === 'baileys') {
    const baileysUrl = process.env.BAILEYS_API_URL || 'http://localhost:3001'
    if (!baileys_instance_id) {
      baileys_instance_id = `inst_${Date.now()}`
    }
    try {
      await fetch(`${baileysUrl}/instancias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: baileys_instance_id, label }),
      })
    } catch {
      return NextResponse.json({ error: 'Servidor Baileys inacessível. Verifique se está rodando.' }, { status: 503 })
    }
  }

  // Se essa vai ser principal, remove principal das outras
  if (principal) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('whatsapp_instancias')
      .update({ principal: false })
      .eq('principal', true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('whatsapp_instancias')
    .insert({
      tipo, label, phone: phone || null,
      meta_phone_number_id: meta_phone_number_id || null,
      meta_access_token: meta_access_token || null,
      meta_waba_id: meta_waba_id || null,
      meta_template_name: meta_template_name || null,
      meta_template_language: meta_template_language || 'pt_BR',
      baileys_instance_id: baileys_instance_id || null,
      principal: principal ?? false,
      ativo: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

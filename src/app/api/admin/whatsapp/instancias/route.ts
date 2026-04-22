import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type InstanciaRow = {
  id: string; tipo: string; label: string; phone: string | null;
  meta_phone_number_id: string | null; meta_access_token: string | null;
  meta_waba_id: string | null; meta_template_name: string | null;
  meta_template_language: string | null; baileys_instance_id: string | null;
  principal: boolean; ativo: boolean; criado_em: string;
  _inline_status?: string; _inline_detalhe?: string | null; _inline_qr?: string | null;
  _auto?: boolean;
}

export async function GET() {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dbData } = await (supabase as any)
    .from('whatsapp_instancias')
    .select('*')
    .order('criado_em', { ascending: true })

  const lista: InstanciaRow[] = [...(dbData ?? [])]
  const dbBaileysIds = new Set(lista.map((i) => i.baileys_instance_id).filter(Boolean))
  const dbMetaIds = new Set(lista.map((i) => i.meta_phone_number_id).filter(Boolean))

  // — Meta configurado via env vars (se não estiver na tabela) —
  const envMetaId = process.env.META_PHONE_NUMBER_ID
  if (envMetaId && !dbMetaIds.has(envMetaId)) {
    lista.unshift({
      id: `env-meta-${envMetaId}`,
      tipo: 'meta',
      label: 'Meta API (configuração principal)',
      phone: process.env.META_WHATSAPP_NUMBER ?? null,
      meta_phone_number_id: envMetaId,
      meta_access_token: process.env.META_ACCESS_TOKEN ? `${process.env.META_ACCESS_TOKEN.slice(0, 12)}••••` : null,
      meta_waba_id: process.env.META_WABA_ID ?? null,
      meta_template_name: process.env.META_TEMPLATE_NAME ?? null,
      meta_template_language: process.env.META_TEMPLATE_LANGUAGE ?? 'pt_BR',
      baileys_instance_id: null,
      principal: lista.length === 0,
      ativo: true,
      criado_em: new Date().toISOString(),
      _inline_status: 'configurado',
      _inline_detalhe: process.env.META_WHATSAPP_NUMBER ?? envMetaId,
      _inline_qr: null,
      _auto: true,
    })
  }

  // — Instâncias Baileys do servidor local (se não estiverem na tabela) —
  const baileysUrl = process.env.BAILEYS_API_URL || 'http://localhost:3001'
  try {
    const res = await fetch(`${baileysUrl}/instancias`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const servidorInstancias: Array<{
        id: string; label: string; status: string; phone: string | null; connected: boolean; temQr: boolean;
      }> = await res.json()

      for (const inst of servidorInstancias) {
        if (dbBaileysIds.has(inst.id)) continue
        const statusConexao = inst.connected ? 'conectado'
          : inst.status === 'aguardando_qr' ? 'aguardando_qr' : 'offline'

        let qr: string | null = null
        if (inst.temQr && !inst.connected) {
          try {
            const qrRes = await fetch(`${baileysUrl}/instancia/${inst.id}/qr`, {
              signal: AbortSignal.timeout(2000),
            })
            if (qrRes.ok) {
              const qrData = await qrRes.json()
              qr = qrData.qr ?? null
            }
          } catch { /* não fatal */ }
        }

        lista.push({
          id: `baileys-auto-${inst.id}`,
          tipo: 'baileys',
          label: inst.label || `Instância ${inst.id}`,
          phone: inst.phone ? `+${inst.phone}` : null,
          meta_phone_number_id: null, meta_access_token: null,
          meta_waba_id: null, meta_template_name: null, meta_template_language: null,
          baileys_instance_id: inst.id,
          principal: false,
          ativo: true,
          criado_em: new Date().toISOString(),
          _inline_status: statusConexao,
          _inline_detalhe: inst.phone ? `+${inst.phone}` : null,
          _inline_qr: qr,
          _auto: true,
        })
      }
    }
  } catch { /* servidor Baileys offline */ }

  return NextResponse.json(lista)
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

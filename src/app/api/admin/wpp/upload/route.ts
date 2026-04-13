import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — faz upload de mídia para o bucket wpp-media e retorna a URL pública
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'arquivo obrigatório' }, { status: 400 })

    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const supabase = createAdminClient()
    const { error } = await supabase.storage
      .from('wpp-media')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('wpp-media').getPublicUrl(path)

    return NextResponse.json({ url: publicUrl, filename: file.name, type: file.type })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

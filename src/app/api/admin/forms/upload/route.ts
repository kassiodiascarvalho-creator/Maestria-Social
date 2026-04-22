import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Upload de imagem de fundo para formulário
// Body: FormData com fields: form_id + file (imagem)
export async function POST(req: NextRequest) {
  const supabase = createAdminClient() as any
  const form = await req.formData()
  const formId = form.get('form_id') as string
  const file = form.get('file') as File | null

  if (!formId || !file) {
    return NextResponse.json({ error: 'form_id e file obrigatórios' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'Formato não suportado. Use JPG, PNG ou WebP.' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5 MB.' }, { status: 400 })
  }

  const path = `form-backgrounds/${formId}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage
    .from('wpp-media')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('wpp-media').getPublicUrl(path)
  const url = urlData.publicUrl

  return NextResponse.json({ url })
}

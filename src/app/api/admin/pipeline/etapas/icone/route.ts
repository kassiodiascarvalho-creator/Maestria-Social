import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Upload de ícone customizado para uma etapa
// Body: FormData com fields: id (etapa id) + file (imagem SVG/PNG)
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const form = await req.formData()
  const id = form.get('id') as string
  const file = form.get('file') as File | null

  if (!id || !file) {
    return NextResponse.json({ error: 'id e file obrigatórios' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'svg'
  const path = `pipeline-icons/${id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage
    .from('wpp-media')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('wpp-media').getPublicUrl(path)
  const icone_url = urlData.publicUrl

  const { data, error } = await supabase
    .from('pipeline_etapas').update({ icone_url }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

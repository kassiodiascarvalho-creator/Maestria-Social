import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Garante bucket existe
  await admin.storage.createBucket('agenda-fotos', { public: true }).catch(() => {})

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${id}/foto.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('agenda-fotos')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('agenda-fotos').getPublicUrl(path)

  // Salva url + reseta posição
  await admin.from('agenda_pessoas').update({ foto_url: publicUrl, foto_pos_x: 0, foto_pos_y: 0, foto_scale: 1 }).eq('id', id)

  return NextResponse.json({ url: publicUrl })
}

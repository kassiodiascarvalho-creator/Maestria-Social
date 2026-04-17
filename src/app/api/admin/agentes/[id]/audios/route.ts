import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'agente-audios'

// GET — listar áudios do agente
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient() as any
  const { data, error } = await supabase
    .from('agente_audios')
    .select('id,nome,url,tamanho,mimetype,criado_em')
    .eq('agente_id', id)
    .order('criado_em', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — upload de áudio
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient() as any

  const form = await req.formData()
  const file = form.get('file') as File | null
  const nome = (form.get('nome') as string | null)?.trim()

  if (!file || !nome) {
    return NextResponse.json({ error: 'file e nome são obrigatórios' }, { status: 400 })
  }

  // Validar tipo
  if (!file.type.startsWith('audio/')) {
    return NextResponse.json({ error: 'Apenas arquivos de áudio são permitidos' }, { status: 400 })
  }

  // Validar tamanho (máx 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() || 'mp3'
  const path = `${id}/${Date.now()}_${nome.replace(/\s+/g, '-')}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { data: audio, error: dbError } = await supabase
    .from('agente_audios')
    .insert({
      agente_id: id,
      nome,
      url: publicUrl,
      tamanho: file.size,
      mimetype: file.type,
    })
    .select('id,nome,url,tamanho,mimetype,criado_em')
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(audio, { status: 201 })
}

// DELETE — remover áudio
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { audioId } = await req.json()
  if (!audioId) return NextResponse.json({ error: 'audioId obrigatório' }, { status: 400 })

  const supabase = createAdminClient() as any

  const { data: audio } = await supabase
    .from('agente_audios')
    .select('url')
    .eq('id', audioId)
    .eq('agente_id', id)
    .single()

  if (audio?.url) {
    // Extrair path do Storage a partir da URL pública
    const urlObj = new URL(audio.url)
    const storagePath = urlObj.pathname.split(`/storage/v1/object/public/${BUCKET}/`)[1]
    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
  }

  const { error } = await supabase
    .from('agente_audios')
    .delete()
    .eq('id', audioId)
    .eq('agente_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

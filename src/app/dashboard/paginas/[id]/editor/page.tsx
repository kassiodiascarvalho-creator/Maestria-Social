import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Block, PageConfig } from '@/lib/builder/blocks'
import EditorClient from './EditorClient'

interface Props { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export default async function EditorPage({ params }: Props) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { data, error } = await supabase
    .from('paginas')
    .select('id, nome, slug, conteudo, configuracoes')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  return (
    <EditorClient
      paginaId={data.id}
      nomeInicial={data.nome}
      slugInicial={data.slug}
      blocos={(data.conteudo as Block[]) || []}
      config={(data.configuracoes as PageConfig) || {}}
    />
  )
}

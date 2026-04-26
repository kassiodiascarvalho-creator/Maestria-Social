import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Block, PageConfig } from '@/lib/builder/blocks'
import PageViewer from './PageViewer'

export const revalidate = 0 // SSR — sempre fresco

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { data } = await supabase.from('paginas').select('nome, descricao').eq('slug', slug).eq('publicada', true).single()
  return {
    title: data?.nome ?? 'Página',
    description: data?.descricao ?? '',
  }
}

export default async function PaginaPublicaPage({ params }: Props) {
  const { slug } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { data, error } = await supabase
    .from('paginas')
    .select('id, nome, conteudo, configuracoes, publicada')
    .eq('slug', slug)
    .eq('publicada', true)
    .single()

  if (error || !data) notFound()

  return (
    <PageViewer
      nome={data.nome}
      blocks={(data.conteudo as Block[]) || []}
      config={(data.configuracoes as PageConfig) || {}}
    />
  )
}

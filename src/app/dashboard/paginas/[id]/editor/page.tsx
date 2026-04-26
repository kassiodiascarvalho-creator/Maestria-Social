import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Block, PageConfig } from '@/lib/builder/blocks'
import loadDynamic from 'next/dynamic'

// Editor is heavy — load only client-side
const PageBuilder = loadDynamic(() => import('@/components/builder/PageBuilder'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0f1a', color: '#888', fontFamily: 'Inter,system-ui,sans-serif', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🎨</div>
      <p style={{ fontSize: 16, fontWeight: 600 }}>Carregando editor...</p>
    </div>
  ),
})

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
    // Editor takes full viewport, bypassing the dashboard shell padding
    <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
      <PageBuilder
        paginaId={data.id}
        nomeInicial={data.nome}
        slugInicial={data.slug}
        blocos={(data.conteudo as Block[]) || []}
        config={(data.configuracoes as PageConfig) || {}}
      />
    </div>
  )
}

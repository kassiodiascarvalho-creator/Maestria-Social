'use client'

import dynamic from 'next/dynamic'
import type { Block, PageConfig } from '@/lib/builder/blocks'

const PageBuilder = dynamic(() => import('@/components/builder/PageBuilder'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0f1a', color: '#888', fontFamily: 'Inter,system-ui,sans-serif', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🎨</div>
      <p style={{ fontSize: 16, fontWeight: 600 }}>Carregando editor...</p>
    </div>
  ),
})

interface Props {
  paginaId: string
  nomeInicial: string
  slugInicial: string
  blocos: Block[]
  config: PageConfig
}

export default function EditorClient(props: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
      <PageBuilder {...props} />
    </div>
  )
}

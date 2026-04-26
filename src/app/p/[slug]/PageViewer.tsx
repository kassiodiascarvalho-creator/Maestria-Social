'use client'

import { memo, Suspense, lazy } from 'react'
import type { Block, PageConfig } from '@/lib/builder/blocks'

// Lazy-load the animated block renderer — only on client, zero SSR overhead
const AnimatedBlock = lazy(() => import('@/components/builder/AnimatedBlock'))

interface Props {
  nome: string
  blocks: Block[]
  config: PageConfig
}

const PageViewer = memo(function PageViewer({ blocks, config }: Props) {
  const font = config.fontFamily || 'Inter'
  const bg = config.backgroundColor || '#ffffff'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: '${font}', Inter, system-ui, sans-serif; background: ${bg}; color: #111; overflow-x: hidden; }
        img { max-width: 100%; height: auto; }
        a { color: inherit; }
        @media (max-width: 768px) {
          section { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>
      <main>
        {blocks.map(block => (
          <Suspense key={block.id} fallback={<div style={{ minHeight: 80 }} />}>
            <AnimatedBlock block={block} />
          </Suspense>
        ))}
      </main>
    </>
  )
})

export default PageViewer

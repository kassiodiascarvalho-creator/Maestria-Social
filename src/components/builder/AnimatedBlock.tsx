'use client'

import { memo, useRef } from 'react'
import { motion, useInView, type Variants } from 'framer-motion'
import { Block } from '@/lib/builder/blocks'
import { BlockRenderer } from './BlockRenderer'

const VARIANTS: Record<string, Variants> = {
  fadeIn:    { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  slideUp:   { hidden: { opacity: 0, y: 48 }, visible: { opacity: 1, y: 0 } },
  slideLeft: { hidden: { opacity: 0, x: -48 }, visible: { opacity: 1, x: 0 } },
  slideRight:{ hidden: { opacity: 0, x: 48 },  visible: { opacity: 1, x: 0 } },
  zoom:      { hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1 } },
  bounce:    { hidden: { opacity: 0, y: 32 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 18 } } },
}

interface AnimatedBlockProps {
  block: Block
}

const AnimatedBlock = memo(function AnimatedBlock({ block }: AnimatedBlockProps) {
  const animType = (block.props._animType as string) || 'none'
  const animDelay = (block.props._animDelay as number) || 0
  const animDuration = (block.props._animDuration as number) || 600

  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })

  if (animType === 'none' || !VARIANTS[animType]) {
    return <BlockRenderer block={block} />
  }

  return (
    <motion.div
      ref={ref}
      variants={VARIANTS[animType]}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{
        duration: animDuration / 1000,
        delay: animDelay / 1000,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <BlockRenderer block={block} />
    </motion.div>
  )
})

export default AnimatedBlock

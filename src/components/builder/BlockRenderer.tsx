'use client'

import React, { useEffect, useState } from 'react'
import { Block } from '@/lib/builder/blocks'

interface BlockRendererProps {
  block: Block
  preview?: boolean
}

export function BlockRenderer({ block, preview }: BlockRendererProps) {
  const { type, props: p } = block

  const style = (preview
    ? { fontFamily: 'inherit', pointerEvents: 'none' as const }
    : { fontFamily: 'inherit' })

  switch (type) {
    case 'hero': return <HeroBlock p={p} style={style} />
    case 'heading': return <HeadingBlock p={p} style={style} />
    case 'text': return <TextBlock p={p} style={style} />
    case 'button': return <ButtonBlock p={p} style={style} />
    case 'image': return <ImageBlock p={p} style={style} />
    case 'video': return <VideoBlock p={p} />
    case 'spacer': return <SpacerBlock p={p} />
    case 'divider': return <DividerBlock p={p} />
    case 'features': return <FeaturesBlock p={p} />
    case 'testimonial': return <TestimonialBlock p={p} />
    case 'stats': return <StatsBlock p={p} />
    case 'capture-form': return <CaptureFormBlock p={p} />
    case 'accordion': return <AccordionBlock p={p} />
    case 'gallery': return <GalleryBlock p={p} />
    case 'countdown': return <CountdownBlock p={p} />
    case 'badge': return <BadgeBlock p={p} />
    case 'cta-section': return <CtaSectionBlock p={p} />
    case 'social-proof': return <SocialProofBlock p={p} />
    case 'timeline': return <TimelineBlock p={p} />
    case 'pricing': return <PricingBlock p={p} />
    default: return null
  }
}

// ── Hero ─────────────────────────────────────────────────────────
function HeroBlock({ p, style }: { p: Record<string, unknown>; style: React.CSSProperties }) {
  const overlay = Number(p.overlayOpacity ?? 0.5)
  const bgImg = p.backgroundImage as string
  const bgStyle: React.CSSProperties = p.backgroundType === 'image' && p.backgroundImage
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url(${bgImg})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
      }
    : { background: (p.backgroundColor as string) || '#0a0a0a' }

  return (
    <section style={{
      ...bgStyle, color: (p.textColor as string) || '#fff',
      minHeight: (p.minHeight as string) || '80vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', textAlign: (p.alignment as React.CSSProperties['textAlign']) || 'center',
      ...style,
    }}>
      <div style={{ maxWidth: '800px', width: '100%' }}>
        {!!p.eyebrow && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: 4,
            textTransform: 'uppercase', color: '#c2904d',
            border: '1px solid rgba(194,144,77,.3)', padding: '7px 18px',
            borderRadius: 40, background: 'rgba(194,144,77,.08)', marginBottom: 28,
          }}>{p.eyebrow as string}</div>
        )}
        {!!p.title && <h1 style={{
          fontSize: 'clamp(40px,6vw,80px)', fontWeight: 800,
          lineHeight: 1.08, marginBottom: 20, letterSpacing: '-1px',
        }}>{p.title as string}</h1>}
        {!!p.subtitle && <p style={{
          fontSize: 'clamp(16px,2vw,22px)', opacity: 0.85,
          lineHeight: 1.7, marginBottom: 12, maxWidth: '640px',
          margin: '0 auto 12px',
        }}>{p.subtitle as string}</p>}
        {!!p.description && <p style={{
          fontSize: 15, opacity: 0.65, lineHeight: 1.8,
          marginBottom: 40, maxWidth: '560px', margin: '0 auto 40px',
        }}>{p.description as string}</p>}
        <div style={{ display: 'flex', gap: 12, justifyContent: p.alignment === 'left' ? 'flex-start' : 'center', flexWrap: 'wrap', marginTop: 32 }}>
          {!!p.ctaText && (
            <a href={(p.ctaUrl as string) || '#'} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '15px 32px', background: '#c2904d', color: '#fff',
              borderRadius: 10, fontWeight: 700, fontSize: 16,
              textDecoration: 'none', transition: 'filter .2s',
            }}>{p.ctaText as string}</a>
          )}
          {!!p.ctaSecondaryText && (
            <a href={(p.ctaSecondaryUrl as string) || '#'} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '15px 32px', background: 'rgba(255,255,255,.12)',
              color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 16,
              textDecoration: 'none', border: '1px solid rgba(255,255,255,.2)',
            }}>{p.ctaSecondaryText as string}</a>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Heading ──────────────────────────────────────────────────────
function HeadingBlock({ p, style }: { p: Record<string, unknown>; style: React.CSSProperties }) {
  const Tag = ((p.level as string) || 'h2') as React.ElementType
  return (
    <div style={{ padding: '32px 24px', textAlign: (p.alignment as React.CSSProperties['textAlign']) || 'center', ...style }}>
      <Tag style={{
        fontSize: (p.fontSize as string) || '2rem',
        fontWeight: (p.fontWeight as string) || '700',
        color: (p.color as string) || '#111',
        lineHeight: 1.2, margin: 0,
      }}>{p.text as string}</Tag>
    </div>
  )
}

// ── Text ─────────────────────────────────────────────────────────
function TextBlock({ p, style }: { p: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{
      padding: '16px 24px',
      display: 'flex',
      justifyContent: p.alignment === 'center' ? 'center' : p.alignment === 'right' ? 'flex-end' : 'flex-start',
      ...style,
    }}>
      <p style={{
        fontSize: (p.fontSize as string) || '1rem',
        color: (p.color as string) || '#444',
        lineHeight: 1.8, margin: 0,
        maxWidth: (p.maxWidth as string) || '720px',
        textAlign: (p.alignment as React.CSSProperties['textAlign']) || 'left',
        whiteSpace: 'pre-wrap',
      }}>{p.content as string}</p>
    </div>
  )
}

// ── Button ───────────────────────────────────────────────────────
function ButtonBlock({ p, style }: { p: Record<string, unknown>; style: React.CSSProperties }) {
  const variant = p.variant as string
  const isPrimary = variant !== 'outline' && variant !== 'ghost'
  const sizes = { sm: '10px 20px', md: '12px 28px', lg: '15px 36px', xl: '18px 48px' }
  const fontSize = { sm: '13px', md: '15px', lg: '16px', xl: '18px' }
  const size = (p.size as string) || 'lg'
  return (
    <div style={{ padding: '16px 24px', display: 'flex', justifyContent: p.alignment === 'center' ? 'center' : p.alignment === 'right' ? 'flex-end' : 'flex-start', ...style }}>
      <a href={(p.url as string) || '#'} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: sizes[size as keyof typeof sizes] || sizes.lg,
        background: isPrimary ? ((p.backgroundColor as string) || '#c2904d') : 'transparent',
        color: isPrimary ? ((p.textColor as string) || '#fff') : ((p.backgroundColor as string) || '#c2904d'),
        border: !isPrimary ? `2px solid ${(p.backgroundColor as string) || '#c2904d'}` : 'none',
        borderRadius: (p.borderRadius as string) || '8px',
        fontWeight: 700, fontSize: fontSize[size as keyof typeof fontSize] || fontSize.lg,
        textDecoration: 'none', cursor: 'pointer',
      }}>
        {p.text as string}{p.icon ? ` ${p.icon as string}` : ''}
      </a>
    </div>
  )
}

// ── Image ────────────────────────────────────────────────────────
function ImageBlock({ p, style }: { p: Record<string, unknown>; style: React.CSSProperties }) {
  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', alignItems: p.alignment === 'center' ? 'center' : p.alignment === 'right' ? 'flex-end' : 'flex-start', ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.src as string} alt={(p.alt as string) || ''} style={{
        maxWidth: (p.maxWidth as string) || '100%', width: '100%',
        borderRadius: (p.borderRadius as string) || '12px',
        boxShadow: p.shadow ? '0 20px 60px rgba(0,0,0,.15)' : 'none',
        display: 'block',
      }} />
      {!!p.caption && <p style={{ fontSize: 13, color: '#888', marginTop: 8, textAlign: 'center' }}>{p.caption as string}</p>}
    </div>
  )
}

// ── Video ────────────────────────────────────────────────────────
function VideoBlock({ p }: { p: Record<string, unknown> }) {
  const url = (p.url as string) || ''
  const isYoutube = url.includes('youtube') || url.includes('youtu.be')
  const isVimeo = url.includes('vimeo')
  let embedUrl = url
  if (isYoutube) {
    const id = url.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1]
    if (id) embedUrl = `https://www.youtube.com/embed/${id}`
  } else if (isVimeo) {
    const id = url.match(/vimeo\.com\/(\d+)/)?.[1]
    if (id) embedUrl = `https://player.vimeo.com/video/${id}`
  }
  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ position: 'relative', paddingBottom: p.aspectRatio === '9/16' ? '177%' : '56.25%', borderRadius: (p.borderRadius as string) || '12px', overflow: 'hidden', background: '#000' }}>
        <iframe src={embedUrl} title={(p.title as string) || 'Vídeo'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
      </div>
    </div>
  )
}

// ── Spacer ───────────────────────────────────────────────────────
function SpacerBlock({ p }: { p: Record<string, unknown> }) {
  return <div style={{ height: (p.height as string) || '48px' }} />
}

// ── Divider ──────────────────────────────────────────────────────
function DividerBlock({ p }: { p: Record<string, unknown> }) {
  return (
    <div style={{ padding: '8px 24px', display: 'flex', justifyContent: 'center' }}>
      <hr style={{
        width: (p.width as string) || '80%',
        borderTop: `${(p.thickness as string) || '1px'} ${(p.style as string) || 'solid'} ${(p.color as string) || '#e5e7eb'}`,
        border: 'none',
        borderTopStyle: (p.style as React.CSSProperties['borderTopStyle']) || 'solid',
        borderTopWidth: (p.thickness as string) || '1px',
        borderTopColor: (p.color as string) || '#e5e7eb',
      }} />
    </div>
  )
}

// ── Features ─────────────────────────────────────────────────────
function FeaturesBlock({ p }: { p: Record<string, unknown> }) {
  const items = (p.items as Array<{ icon: string; title: string; description: string; color?: string }>) || []
  const cols = (p.columns as number) || 3
  const style = (p.style as string) || 'cards'
  return (
    <section style={{ padding: '60px 24px' }}>
      {!!p.title && <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px,3vw,36px)', fontWeight: 800, marginBottom: 8, color: '#111' }}>{p.title as string}</h2>}
      {!!p.subtitle && <p style={{ textAlign: 'center', color: '#666', fontSize: 17, marginBottom: 48 }}>{p.subtitle as string}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 2 ? '280px' : '220px'}, 1fr))`, gap: 24, maxWidth: 1100, margin: '0 auto' }}>
        {items.map((item, i) => (
          <div key={i} style={{
            padding: style === 'cards' ? '32px 24px' : '20px',
            background: style === 'cards' ? '#f9fafb' : 'transparent',
            borderRadius: style === 'cards' ? 16 : 0,
            border: style === 'cards' ? '1px solid #e5e7eb' : 'none',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16, display: 'block', lineHeight: 1 }}>{item.icon}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#111' }}>{item.title}</h3>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, margin: 0 }}>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Testimonial ──────────────────────────────────────────────────
function TestimonialBlock({ p }: { p: Record<string, unknown> }) {
  return (
    <section style={{ padding: '48px 24px', background: (p.backgroundColor as string) || '#f9fafb' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        {!!p.rating && (
          <div style={{ fontSize: 20, marginBottom: 16, color: '#f59e0b' }}>
            {'⭐'.repeat(p.rating as number)}
          </div>
        )}
        <blockquote style={{
          fontSize: 'clamp(17px,2vw,22px)', fontStyle: 'italic',
          color: (p.textColor as string) || '#111',
          lineHeight: 1.7, margin: '0 0 28px', fontWeight: 400,
        }}>"{p.quote as string}"</blockquote>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          {!!p.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar as string} alt={p.author as string} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
          )}
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontWeight: 700, margin: 0, color: '#111', fontSize: 15 }}>{p.author as string}</p>
            <p style={{ color: '#888', margin: 0, fontSize: 13 }}>{p.role as string}{p.company ? ` • ${p.company as string}` : ''}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Stats ────────────────────────────────────────────────────────
function StatsBlock({ p }: { p: Record<string, unknown> }) {
  const items = (p.items as Array<{ value: string; label: string; prefix?: string; suffix?: string }>) || []
  return (
    <section style={{ padding: '60px 24px', background: (p.backgroundColor as string) || '#111', color: (p.textColor as string) || '#fff' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 32, textAlign: 'center' }}>
        {items.map((item, i) => (
          <div key={i}>
            <div style={{ fontSize: 'clamp(36px,5vw,56px)', fontWeight: 900, color: (p.accentColor as string) || '#c2904d', lineHeight: 1, marginBottom: 8 }}>
              {item.prefix}{item.value}{item.suffix}
            </div>
            <div style={{ fontSize: 14, opacity: 0.7, letterSpacing: 1, textTransform: 'uppercase' }}>{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Capture Form ─────────────────────────────────────────────────
function CaptureFormBlock({ p }: { p: Record<string, unknown> }) {
  const [submitted, setSubmitted] = useState(false)
  const fields = (p.fields as Array<{ name: string; label: string; type: string; placeholder: string; required: boolean }>) || []
  return (
    <section style={{ padding: '60px 24px', background: (p.backgroundColor as string) || '#fff' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {!!p.title && <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, marginBottom: 8, color: '#111' }}>{p.title as string}</h2>}
        {!!p.subtitle && <p style={{ textAlign: 'center', color: '#666', marginBottom: 32, fontSize: 16 }}>{p.subtitle as string}</p>}
        {submitted ? (
          <div style={{ textAlign: 'center', padding: 40, background: '#f0fdf4', borderRadius: 16, border: '1px solid #86efac' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: 18, color: '#166534' }}>{(p.successMessage as string) || 'Obrigado! Em breve entraremos em contato.'}</p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); setSubmitted(true) }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fields.map((field) => (
              <div key={field.name}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>{field.label}{field.required && ' *'}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  required={field.required}
                  style={{
                    width: '100%', padding: '13px 16px',
                    border: '1px solid #d1d5db', borderRadius: 10,
                    fontSize: 15, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ))}
            <button type="submit" style={{
              padding: '15px 24px', background: '#c2904d', color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16,
              cursor: 'pointer', marginTop: 8, fontFamily: 'inherit',
            }}>{(p.ctaText as string) || 'Enviar'}</button>
          </form>
        )}
      </div>
    </section>
  )
}

// ── Accordion ────────────────────────────────────────────────────
function AccordionBlock({ p }: { p: Record<string, unknown> }) {
  const [open, setOpen] = useState<number | null>(null)
  const items = (p.items as Array<{ question: string; answer: string }>) || []
  return (
    <section style={{ padding: '60px 24px' }}>
      {!!p.title && <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, marginBottom: 40, color: '#111' }}>{p.title as string}</h2>}
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === i ? null : i)} style={{
              width: '100%', padding: '18px 24px', background: open === i ? '#f9fafb' : '#fff',
              border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
              fontSize: 16, fontWeight: 600, color: '#111', fontFamily: 'inherit',
            }}>
              {item.question}
              <span style={{ fontSize: 20, color: '#888', transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
            </button>
            {open === i && (
              <div style={{ padding: '0 24px 20px', color: '#555', lineHeight: 1.7, fontSize: 15 }}>{item.answer}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Gallery ──────────────────────────────────────────────────────
function GalleryBlock({ p }: { p: Record<string, unknown> }) {
  const images = (p.images as Array<{ src: string; alt: string; caption?: string }>) || []
  const cols = (p.columns as number) || 3
  return (
    <section style={{ padding: '32px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 2 ? '280px' : '200px'}, 1fr))`, gap: (p.gap as string) || '16px', maxWidth: 1100, margin: '0 auto' }}>
        {images.map((img, i) => (
          <div key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: (p.borderRadius as string) || '12px', display: 'block' }} />
            {img.caption && <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 6 }}>{img.caption}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Countdown ────────────────────────────────────────────────────
function CountdownBlock({ p }: { p: Record<string, unknown> }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 })

  useEffect(() => {
    const target = new Date(p.targetDate as string).getTime()
    const tick = () => {
      const diff = Math.max(0, target - Date.now())
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [p.targetDate])

  const accent = (p.accentColor as string) || '#c2904d'
  const unit = (label: string, value: number) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 'clamp(40px,6vw,72px)', fontWeight: 900, color: accent, lineHeight: 1 }}>{String(value).padStart(2, '0')}</div>
      <div style={{ fontSize: 12, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 2, marginTop: 4 }}>{label}</div>
    </div>
  )
  const sep = <div style={{ fontSize: 'clamp(32px,4vw,56px)', fontWeight: 900, color: accent, opacity: 0.5, alignSelf: 'flex-start', marginTop: 6 }}>:</div>

  return (
    <section style={{ padding: '60px 24px', background: (p.backgroundColor as string) || '#1a1a1a', color: (p.textColor as string) || '#fff', textAlign: 'center' }}>
      {!!p.title && <h2 style={{ fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 600, marginBottom: 40, opacity: 0.85 }}>{p.title as string}</h2>}
      <div style={{ display: 'flex', gap: 'clamp(16px,3vw,40px)', justifyContent: 'center', alignItems: 'flex-start' }}>
        {unit('Dias', time.d)}{sep}{unit('Horas', time.h)}{sep}{unit('Min', time.m)}{sep}{unit('Seg', time.s)}
      </div>
    </section>
  )
}

// ── Badge ────────────────────────────────────────────────────────
function BadgeBlock({ p }: { p: Record<string, unknown> }) {
  const size = (p.size as string) || 'md'
  const sizes = { sm: '6px 12px', md: '8px 16px', lg: '10px 24px' }
  const fontSize = { sm: '11px', md: '13px', lg: '15px' }
  return (
    <div style={{ padding: '8px 24px', display: 'flex', justifyContent: 'center' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: sizes[size as keyof typeof sizes] || sizes.md,
        background: (p.backgroundColor as string) || '#fef3c7',
        color: (p.textColor as string) || '#92400e',
        borderRadius: 40, fontWeight: 700,
        fontSize: fontSize[size as keyof typeof fontSize] || fontSize.md,
        letterSpacing: 0.3,
      }}>
        {!!p.icon && <span>{p.icon as string}</span>}
        {p.text as string}
      </span>
    </div>
  )
}

// ── CTA Section ──────────────────────────────────────────────────
function CtaSectionBlock({ p }: { p: Record<string, unknown> }) {
  return (
    <section style={{
      padding: '80px 24px', textAlign: 'center',
      background: (p.backgroundColor as string) || '#c2904d',
      color: (p.textColor as string) || '#fff',
      position: 'relative', overflow: 'hidden',
    }}>
      {!!p.title && <h2 style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 900, marginBottom: 16, lineHeight: 1.15 }}>{p.title as string}</h2>}
      {!!p.description && <p style={{ fontSize: 'clamp(15px,2vw,20px)', opacity: 0.88, marginBottom: 40, maxWidth: 580, margin: '0 auto 40px', lineHeight: 1.7 }}>{p.description as string}</p>}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {!!p.ctaText && (
          <a href={(p.ctaUrl as string) || '#'} style={{
            padding: '16px 36px', background: '#fff',
            color: (p.backgroundColor as string) || '#c2904d',
            borderRadius: 10, fontWeight: 800, fontSize: 16,
            textDecoration: 'none',
          }}>{p.ctaText as string}</a>
        )}
        {!!p.secondaryCta && (
          <a href="#" style={{
            padding: '16px 36px', border: '2px solid rgba(255,255,255,.5)',
            color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 16,
            textDecoration: 'none', background: 'transparent',
          }}>{p.secondaryCta as string}</a>
        )}
      </div>
    </section>
  )
}

// ── Social Proof ─────────────────────────────────────────────────
function SocialProofBlock({ p }: { p: Record<string, unknown> }) {
  const logos = (p.logos as Array<{ src: string; alt: string; url?: string }>) || []
  return (
    <section style={{ padding: '48px 24px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
      {!!p.title && <p style={{ textAlign: 'center', fontSize: 13, color: '#999', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 32 }}>{p.title as string}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center', alignItems: 'center' }}>
        {logos.map((logo, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={logo.src} alt={logo.alt} style={{ height: 32, opacity: 0.5, filter: 'grayscale(100%)', objectFit: 'contain', maxWidth: 120 }} />
        ))}
      </div>
    </section>
  )
}

// ── Timeline ─────────────────────────────────────────────────────
function TimelineBlock({ p }: { p: Record<string, unknown> }) {
  const items = (p.items as Array<{ step: string; title: string; description: string; icon?: string }>) || []
  return (
    <section style={{ padding: '60px 24px' }}>
      {!!p.title && <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,36px)', fontWeight: 800, marginBottom: 56, color: '#111' }}>{p.title as string}</h2>}
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 24, paddingBottom: i < items.length - 1 ? 40 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#c2904d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                {item.icon || item.step}
              </div>
              {i < items.length - 1 && <div style={{ width: 2, flex: 1, background: '#e5e7eb', margin: '8px 0' }} />}
            </div>
            <div style={{ paddingTop: 10, paddingBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18, color: '#111', marginBottom: 6 }}>{item.title}</h3>
              <p style={{ color: '#666', lineHeight: 1.7, fontSize: 15, margin: 0 }}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Pricing ──────────────────────────────────────────────────────
function PricingBlock({ p }: { p: Record<string, unknown> }) {
  const plans = (p.plans as Array<{
    name: string; price: string; period: string; description: string;
    features: string[]; ctaText: string; ctaUrl: string; highlighted: boolean;
  }>) || []
  return (
    <section style={{ padding: '60px 24px' }}>
      {!!p.title && <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,36px)', fontWeight: 800, marginBottom: 8, color: '#111' }}>{p.title as string}</h2>}
      {!!p.subtitle && <p style={{ textAlign: 'center', color: '#666', marginBottom: 48 }}>{p.subtitle as string}</p>}
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`, gap: 24 }}>
        {plans.map((plan, i) => (
          <div key={i} style={{
            padding: '36px 28px', borderRadius: 20,
            border: plan.highlighted ? '2px solid #c2904d' : '1px solid #e5e7eb',
            background: plan.highlighted ? '#fffbf5' : '#fff',
            position: 'relative',
          }}>
            {plan.highlighted && (
              <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#c2904d', color: '#fff', padding: '4px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>MAIS POPULAR</div>
            )}
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>{plan.name}</h3>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>{plan.description}</p>
            <div style={{ marginBottom: 28 }}>
              <span style={{ fontSize: 'clamp(36px,4vw,48px)', fontWeight: 900, color: '#111' }}>{plan.price}</span>
              {plan.period && <span style={{ color: '#888', fontSize: 16 }}>{plan.period}</span>}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plan.features.map((f, fi) => (
                <li key={fi} style={{ fontSize: 14, color: '#444', display: 'flex', gap: 8 }}>{f}</li>
              ))}
            </ul>
            <a href={plan.ctaUrl || '#'} style={{
              display: 'block', textAlign: 'center', padding: '13px 24px',
              background: plan.highlighted ? '#c2904d' : '#111',
              color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15,
              textDecoration: 'none',
            }}>{plan.ctaText}</a>
          </div>
        ))}
      </div>
    </section>
  )
}

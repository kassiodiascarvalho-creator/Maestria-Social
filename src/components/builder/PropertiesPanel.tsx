'use client'

import { memo, useState, useCallback } from 'react'
import { Block, BLOCK_META } from '@/lib/builder/blocks'

interface Props {
  block: Block
  onChange: (props: Record<string, unknown>) => void
}

const PropertiesPanel = memo(function PropertiesPanel({ block, onChange }: Props) {
  const meta = BLOCK_META.find(m => m.type === block.type)
  const p = block.props
  const [openSection, setOpenSection] = useState<string>('content')

  const set = useCallback((key: string, val: unknown) => onChange({ [key]: val }), [onChange])

  const Section = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
    <div style={{ borderBottom: '1px solid #2d2d4a' }}>
      <button onClick={() => setOpenSection(s => s === id ? '' : id)} style={{
        width: '100%', padding: '12px 16px', background: 'none', border: 'none',
        color: openSection === id ? '#fff' : '#888', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'inherit',
      }}>
        {label} <span style={{ fontSize: 14, opacity: 0.5 }}>{openSection === id ? '▲' : '▼'}</span>
      </button>
      {openSection === id && <div style={{ padding: '4px 12px 16px' }}>{children}</div>}
    </div>
  )

  return (
    <div style={{ color: '#ccc', fontSize: 13, overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #2d2d4a', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24 }}>{meta?.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{meta?.label}</div>
          <div style={{ fontSize: 11, color: '#666' }}>{meta?.description}</div>
        </div>
      </div>

      {/* Animation */}
      <Section id="animation" label="✨ Animação">
        <Field label="Tipo">
          <Select value={(p._animType as string) || 'none'} onChange={v => set('_animType', v)} options={[
            { value: 'none', label: 'Nenhuma' },
            { value: 'fadeIn', label: 'Fade In' },
            { value: 'slideUp', label: 'Subir' },
            { value: 'slideLeft', label: 'Da esquerda' },
            { value: 'slideRight', label: 'Da direita' },
            { value: 'zoom', label: 'Zoom' },
            { value: 'bounce', label: 'Bounce' },
          ]} />
        </Field>
        {(p._animType as string) && (p._animType as string) !== 'none' && <>
          <Field label={`Delay: ${p._animDelay || 0}ms`}>
            <input type="range" min={0} max={1500} step={100} value={(p._animDelay as number) || 0}
              onChange={e => set('_animDelay', Number(e.target.value))} style={{ width: '100%', accentColor: '#6366f1' }} />
          </Field>
          <Field label={`Duração: ${p._animDuration || 600}ms`}>
            <input type="range" min={200} max={2000} step={100} value={(p._animDuration as number) || 600}
              onChange={e => set('_animDuration', Number(e.target.value))} style={{ width: '100%', accentColor: '#6366f1' }} />
          </Field>
        </>}
      </Section>

      {/* Content section — block-specific */}
      <Section id="content" label="📝 Conteúdo">
        <BlockSpecificProps type={block.type} p={p} set={set} />
      </Section>

      {/* Style section — common */}
      <Section id="style" label="🎨 Estilo">
        <BlockStyleProps type={block.type} p={p} set={set} />
      </Section>
    </div>
  )
})

export default PropertiesPanel

// ── Block-specific content fields ────────────────────────────────
function BlockSpecificProps({ type, p, set }: { type: string; p: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  switch (type) {
    case 'hero': return <>
      <Field label="Eyebrow"><TextIn value={p.eyebrow} set={v => set('eyebrow', v)} /></Field>
      <Field label="Título"><TextArea value={p.title} set={v => set('title', v)} rows={3} /></Field>
      <Field label="Subtítulo"><TextArea value={p.subtitle} set={v => set('subtitle', v)} /></Field>
      <Field label="Descrição"><TextArea value={p.description} set={v => set('description', v)} /></Field>
      <Field label="Botão Principal">
        <TextIn value={p.ctaText} set={v => set('ctaText', v)} placeholder="Texto" />
        <TextIn value={p.ctaUrl} set={v => set('ctaUrl', v)} placeholder="URL" style={{ marginTop: 4 }} />
      </Field>
      <Field label="Botão Secundário">
        <TextIn value={p.ctaSecondaryText} set={v => set('ctaSecondaryText', v)} placeholder="Texto" />
        <TextIn value={p.ctaSecondaryUrl} set={v => set('ctaSecondaryUrl', v)} placeholder="URL" style={{ marginTop: 4 }} />
      </Field>
      <Field label="Alinhamento">
        <AlignButtons value={p.alignment as string} onChange={v => set('alignment', v)} />
      </Field>
      <Field label="Altura mínima">
        <Select value={(p.minHeight as string) || '80vh'} onChange={v => set('minHeight', v)} options={[
          { value: '50vh', label: '50% tela' }, { value: '70vh', label: '70% tela' },
          { value: '80vh', label: '80% tela' }, { value: '100vh', label: 'Tela cheia' },
          { value: 'auto', label: 'Automático' },
        ]} />
      </Field>
    </>

    case 'heading': return <>
      <Field label="Texto"><TextArea value={p.text} set={v => set('text', v)} /></Field>
      <Field label="Nível">
        <Select value={(p.level as string) || 'h2'} onChange={v => set('level', v)} options={
          ['h1','h2','h3','h4','h5','h6'].map(h => ({ value: h, label: h.toUpperCase() }))
        } />
      </Field>
      <Field label="Alinhamento"><AlignButtons value={p.alignment as string} onChange={v => set('alignment', v)} /></Field>
      <Field label="Tamanho">
        <Select value={(p.fontSize as string) || '2rem'} onChange={v => set('fontSize', v)} options={[
          { value: '1.25rem', label: 'Pequeno' }, { value: '1.75rem', label: 'Médio' },
          { value: '2.5rem', label: 'Grande' }, { value: '3.5rem', label: 'Enorme' },
          { value: 'clamp(28px,4vw,56px)', label: 'Responsivo' },
        ]} />
      </Field>
    </>

    case 'text': return <>
      <Field label="Conteúdo"><TextArea value={p.content} set={v => set('content', v)} rows={6} /></Field>
      <Field label="Alinhamento"><AlignButtons value={p.alignment as string} onChange={v => set('alignment', v)} /></Field>
      <Field label="Largura máxima">
        <Select value={(p.maxWidth as string) || '720px'} onChange={v => set('maxWidth', v)} options={[
          { value: '480px', label: '480px' }, { value: '600px', label: '600px' },
          { value: '720px', label: '720px (padrão)' }, { value: '960px', label: '960px' }, { value: '100%', label: 'Cheio' },
        ]} />
      </Field>
    </>

    case 'button': return <>
      <Field label="Texto"><TextIn value={p.text} set={v => set('text', v)} /></Field>
      <Field label="URL"><TextIn value={p.url} set={v => set('url', v)} placeholder="https://" /></Field>
      <Field label="Variante">
        <Select value={(p.variant as string) || 'primary'} onChange={v => set('variant', v)} options={[
          { value: 'primary', label: 'Primário (sólido)' },
          { value: 'outline', label: 'Contorno' },
          { value: 'ghost', label: 'Ghost' },
        ]} />
      </Field>
      <Field label="Tamanho">
        <Select value={(p.size as string) || 'lg'} onChange={v => set('size', v)} options={[
          { value: 'sm', label: 'Pequeno' }, { value: 'md', label: 'Médio' },
          { value: 'lg', label: 'Grande' }, { value: 'xl', label: 'Extra Grande' },
        ]} />
      </Field>
      <Field label="Alinhamento"><AlignButtons value={p.alignment as string} onChange={v => set('alignment', v)} /></Field>
      <Field label="Ícone"><TextIn value={p.icon} set={v => set('icon', v)} placeholder="→ (emoji ou símbolo)" /></Field>
    </>

    case 'image': return <>
      <Field label="URL da imagem"><TextIn value={p.src} set={v => set('src', v)} placeholder="https://..." /></Field>
      <Field label="Texto alternativo"><TextIn value={p.alt} set={v => set('alt', v)} /></Field>
      <Field label="Legenda"><TextIn value={p.caption} set={v => set('caption', v)} /></Field>
      <Field label="Alinhamento"><AlignButtons value={p.alignment as string} onChange={v => set('alignment', v)} /></Field>
    </>

    case 'video': return <>
      <Field label="URL do vídeo"><TextIn value={p.url} set={v => set('url', v)} placeholder="YouTube, Vimeo..." /></Field>
      <Field label="Título"><TextIn value={p.title} set={v => set('title', v)} /></Field>
      <Field label="Proporção">
        <Select value={(p.aspectRatio as string) || '16/9'} onChange={v => set('aspectRatio', v)} options={[
          { value: '16/9', label: '16:9 (padrão)' }, { value: '4/3', label: '4:3' }, { value: '1/1', label: '1:1 (quadrado)' }, { value: '9/16', label: '9:16 (vertical)' },
        ]} />
      </Field>
    </>

    case 'spacer': return <>
      <Field label={`Altura: ${p.height || '60px'}`}>
        <input type="range" min={8} max={200} step={8}
          value={parseInt((p.height as string) || '60')}
          onChange={e => set('height', `${e.target.value}px`)}
          style={{ width: '100%', accentColor: '#6366f1' }} />
      </Field>
    </>

    case 'divider': return <>
      <Field label="Estilo">
        <Select value={(p.style as string) || 'solid'} onChange={v => set('style', v)} options={[
          { value: 'solid', label: 'Sólido' }, { value: 'dashed', label: 'Tracejado' }, { value: 'dotted', label: 'Pontilhado' },
        ]} />
      </Field>
      <Field label="Espessura">
        <Select value={(p.thickness as string) || '1px'} onChange={v => set('thickness', v)} options={[
          { value: '1px', label: '1px' }, { value: '2px', label: '2px' }, { value: '3px', label: '3px' },
        ]} />
      </Field>
    </>

    case 'features': return <>
      <Field label="Título"><TextIn value={p.title} set={v => set('title', v)} /></Field>
      <Field label="Subtítulo"><TextIn value={p.subtitle} set={v => set('subtitle', v)} /></Field>
      <Field label="Colunas">
        <Select value={String((p.columns as number) || 3)} onChange={v => set('columns', Number(v))} options={[
          { value: '1', label: '1 coluna' }, { value: '2', label: '2 colunas' }, { value: '3', label: '3 colunas' }, { value: '4', label: '4 colunas' },
        ]} />
      </Field>
      <Field label="Estilo">
        <Select value={(p.style as string) || 'cards'} onChange={v => set('style', v)} options={[
          { value: 'cards', label: 'Cards' }, { value: 'list', label: 'Lista' }, { value: 'minimal', label: 'Minimal' },
        ]} />
      </Field>
      <ArrayEditor
        label="Itens"
        items={(p.items as Array<Record<string, unknown>>) || []}
        onChange={items => set('items', items)}
        defaultItem={{ icon: '✨', title: 'Novo item', description: 'Descrição do item', color: '#c2904d' }}
        fields={[
          { key: 'icon', label: 'Ícone', type: 'text' },
          { key: 'title', label: 'Título', type: 'text' },
          { key: 'description', label: 'Descrição', type: 'textarea' },
          { key: 'color', label: 'Cor', type: 'color' },
        ]}
      />
    </>

    case 'testimonial': return <>
      <Field label="Depoimento"><TextArea value={p.quote} set={v => set('quote', v)} rows={4} /></Field>
      <Field label="Nome"><TextIn value={p.author} set={v => set('author', v)} /></Field>
      <Field label="Cargo / Papel"><TextIn value={p.role} set={v => set('role', v)} /></Field>
      <Field label="Empresa"><TextIn value={p.company} set={v => set('company', v)} /></Field>
      <Field label="URL do avatar"><TextIn value={p.avatar} set={v => set('avatar', v)} placeholder="https://..." /></Field>
      <Field label={`Avaliação: ${'⭐'.repeat((p.rating as number) || 5)}`}>
        <input type="range" min={1} max={5} value={(p.rating as number) || 5}
          onChange={e => set('rating', Number(e.target.value))}
          style={{ width: '100%', accentColor: '#f59e0b' }} />
      </Field>
    </>

    case 'stats': return <>
      <ArrayEditor
        label="Estatísticas"
        items={(p.items as Array<Record<string, unknown>>) || []}
        onChange={items => set('items', items)}
        defaultItem={{ value: '100', label: 'Nova Stat', prefix: '+', suffix: '' }}
        fields={[
          { key: 'prefix', label: 'Prefixo (ex: +)', type: 'text' },
          { key: 'value', label: 'Valor', type: 'text' },
          { key: 'suffix', label: 'Sufixo (ex: %)', type: 'text' },
          { key: 'label', label: 'Rótulo', type: 'text' },
        ]}
      />
    </>

    case 'capture-form': return <>
      <Field label="Título"><TextIn value={p.title} set={v => set('title', v)} /></Field>
      <Field label="Subtítulo"><TextIn value={p.subtitle} set={v => set('subtitle', v)} /></Field>
      <Field label="Texto do botão"><TextIn value={p.ctaText} set={v => set('ctaText', v)} /></Field>
      <Field label="Mensagem de sucesso"><TextIn value={p.successMessage} set={v => set('successMessage', v)} /></Field>
      <ArrayEditor
        label="Campos do formulário"
        items={(p.fields as Array<Record<string, unknown>>) || []}
        onChange={items => set('fields', items)}
        defaultItem={{ name: 'campo', label: 'Novo campo', type: 'text', placeholder: '', required: false }}
        fields={[
          { key: 'label', label: 'Rótulo', type: 'text' },
          { key: 'placeholder', label: 'Placeholder', type: 'text' },
          { key: 'type', label: 'Tipo', type: 'select', options: ['text','email','tel','number','select'] },
          { key: 'required', label: 'Obrigatório', type: 'checkbox' },
        ]}
      />
    </>

    case 'accordion': return <>
      <Field label="Título"><TextIn value={p.title} set={v => set('title', v)} /></Field>
      <ArrayEditor
        label="Perguntas"
        items={(p.items as Array<Record<string, unknown>>) || []}
        onChange={items => set('items', items)}
        defaultItem={{ question: 'Nova pergunta?', answer: 'Resposta aqui.' }}
        fields={[
          { key: 'question', label: 'Pergunta', type: 'text' },
          { key: 'answer', label: 'Resposta', type: 'textarea' },
        ]}
      />
    </>

    case 'gallery': return <>
      <Field label="Colunas">
        <Select value={String((p.columns as number) || 3)} onChange={v => set('columns', Number(v))} options={[
          { value: '2', label: '2 colunas' }, { value: '3', label: '3 colunas' }, { value: '4', label: '4 colunas' },
        ]} />
      </Field>
      <ArrayEditor
        label="Imagens"
        items={(p.images as Array<Record<string, unknown>>) || []}
        onChange={items => set('images', items)}
        defaultItem={{ src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80', alt: 'Imagem', caption: '' }}
        fields={[
          { key: 'src', label: 'URL', type: 'text' },
          { key: 'alt', label: 'Alt text', type: 'text' },
          { key: 'caption', label: 'Legenda', type: 'text' },
        ]}
      />
    </>

    case 'countdown': return <>
      <Field label="Título"><TextIn value={p.title} set={v => set('title', v)} /></Field>
      <Field label="Data alvo">
        <input type="datetime-local"
          value={p.targetDate ? new Date(p.targetDate as string).toISOString().slice(0, 16) : ''}
          onChange={e => set('targetDate', new Date(e.target.value).toISOString())}
          style={inputStyle} />
      </Field>
    </>

    case 'badge': return <>
      <Field label="Texto"><TextIn value={p.text} set={v => set('text', v)} /></Field>
      <Field label="Ícone"><TextIn value={p.icon} set={v => set('icon', v)} placeholder="🔥 (emoji)" /></Field>
      <Field label="Tamanho">
        <Select value={(p.size as string) || 'md'} onChange={v => set('size', v)} options={[
          { value: 'sm', label: 'Pequeno' }, { value: 'md', label: 'Médio' }, { value: 'lg', label: 'Grande' },
        ]} />
      </Field>
    </>

    case 'cta-section': return <>
      <Field label="Título"><TextArea value={p.title} set={v => set('title', v)} rows={3} /></Field>
      <Field label="Descrição"><TextArea value={p.description} set={v => set('description', v)} /></Field>
      <Field label="Texto CTA principal"><TextIn value={p.ctaText} set={v => set('ctaText', v)} /></Field>
      <Field label="URL CTA principal"><TextIn value={p.ctaUrl} set={v => set('ctaUrl', v)} placeholder="https://" /></Field>
      <Field label="CTA Secundário"><TextIn value={p.secondaryCta} set={v => set('secondaryCta', v)} /></Field>
    </>

    case 'social-proof': return <>
      <Field label="Título"><TextIn value={p.title} set={v => set('title', v)} /></Field>
      <ArrayEditor
        label="Logos"
        items={(p.logos as Array<Record<string, unknown>>) || []}
        onChange={items => set('logos', items)}
        defaultItem={{ src: '', alt: 'Logo', url: '#' }}
        fields={[
          { key: 'src', label: 'URL da imagem', type: 'text' },
          { key: 'alt', label: 'Nome', type: 'text' },
          { key: 'url', label: 'Link', type: 'text' },
        ]}
      />
    </>

    case 'timeline': return <>
      <Field label="Título"><TextIn value={p.title} set={v => set('title', v)} /></Field>
      <ArrayEditor
        label="Passos"
        items={(p.items as Array<Record<string, unknown>>) || []}
        onChange={items => set('items', items)}
        defaultItem={{ step: '01', icon: '✅', title: 'Novo passo', description: 'Descrição do passo.' }}
        fields={[
          { key: 'step', label: 'Número/Passo', type: 'text' },
          { key: 'icon', label: 'Ícone (emoji)', type: 'text' },
          { key: 'title', label: 'Título', type: 'text' },
          { key: 'description', label: 'Descrição', type: 'textarea' },
        ]}
      />
    </>

    case 'pricing': return <>
      <Field label="Título"><TextIn value={p.title} set={v => set('title', v)} /></Field>
      <Field label="Subtítulo"><TextIn value={p.subtitle} set={v => set('subtitle', v)} /></Field>
      <ArrayEditor
        label="Planos"
        items={(p.plans as Array<Record<string, unknown>>) || []}
        onChange={items => set('plans', items)}
        defaultItem={{ name: 'Pro', price: 'R$ 97', period: '/mês', description: 'Para quem quer crescer', features: ['✅ Feature 1', '✅ Feature 2'], ctaText: 'Assinar', ctaUrl: '#', highlighted: false }}
        fields={[
          { key: 'name', label: 'Nome do plano', type: 'text' },
          { key: 'price', label: 'Preço', type: 'text' },
          { key: 'period', label: 'Período (ex: /mês)', type: 'text' },
          { key: 'description', label: 'Descrição', type: 'text' },
          { key: 'ctaText', label: 'Texto do botão', type: 'text' },
          { key: 'ctaUrl', label: 'URL do botão', type: 'text' },
          { key: 'highlighted', label: 'Destaque (popular)', type: 'checkbox' },
        ]}
      />
    </>

    default: return <p style={{ color: '#555', padding: 8, fontSize: 12 }}>Sem propriedades editáveis</p>
  }
}

// ── Block style fields (common) ────────────────────────────────
function BlockStyleProps({ type, p, set }: { type: string; p: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  return <>
    {/* Color props per block type */}
    {['hero'].includes(type) && <>
      <Field label="Tipo de fundo">
        <Select value={(p.backgroundType as string) || 'color'} onChange={v => set('backgroundType', v)} options={[
          { value: 'color', label: 'Cor sólida' }, { value: 'gradient', label: 'Gradiente' }, { value: 'image', label: 'Imagem' },
        ]} />
      </Field>
      {(p.backgroundType === 'image') && (
        <Field label="URL da imagem de fundo"><TextIn value={p.backgroundImage} set={v => set('backgroundImage', v)} placeholder="https://..." /></Field>
      )}
      <Field label="Cor de fundo"><ColorIn value={p.backgroundColor as string} set={v => set('backgroundColor', v)} /></Field>
      <Field label="Cor do texto"><ColorIn value={p.textColor as string} set={v => set('textColor', v)} /></Field>
    </>}
    {['stats', 'countdown'].includes(type) && <>
      <Field label="Cor de fundo"><ColorIn value={p.backgroundColor as string} set={v => set('backgroundColor', v)} /></Field>
      <Field label="Cor do texto"><ColorIn value={p.textColor as string} set={v => set('textColor', v)} /></Field>
      <Field label="Cor de destaque"><ColorIn value={p.accentColor as string} set={v => set('accentColor', v)} /></Field>
    </>}
    {['testimonial', 'capture-form'].includes(type) && <>
      <Field label="Cor de fundo"><ColorIn value={p.backgroundColor as string} set={v => set('backgroundColor', v)} /></Field>
      {type === 'testimonial' && <Field label="Cor do texto"><ColorIn value={p.textColor as string} set={v => set('textColor', v)} /></Field>}
    </>}
    {['cta-section'].includes(type) && <>
      <Field label="Cor de fundo"><ColorIn value={p.backgroundColor as string} set={v => set('backgroundColor', v)} /></Field>
      <Field label="Cor do texto"><ColorIn value={p.textColor as string} set={v => set('textColor', v)} /></Field>
    </>}
    {['heading'].includes(type) && <>
      <Field label="Cor do texto"><ColorIn value={p.color as string} set={v => set('color', v)} /></Field>
      <Field label="Peso da fonte">
        <Select value={(p.fontWeight as string) || '700'} onChange={v => set('fontWeight', v)} options={[
          { value: '400', label: 'Normal' }, { value: '600', label: 'Semi-bold' }, { value: '700', label: 'Bold' }, { value: '900', label: 'Extra Bold' },
        ]} />
      </Field>
    </>}
    {['text'].includes(type) && (
      <Field label="Cor do texto"><ColorIn value={p.color as string} set={v => set('color', v)} /></Field>
    )}
    {['button'].includes(type) && <>
      <Field label="Cor do botão"><ColorIn value={p.backgroundColor as string} set={v => set('backgroundColor', v)} /></Field>
      <Field label="Cor do texto"><ColorIn value={p.textColor as string} set={v => set('textColor', v)} /></Field>
      <Field label="Border radius">
        <Select value={(p.borderRadius as string) || '8px'} onChange={v => set('borderRadius', v)} options={[
          { value: '0', label: 'Quadrado' }, { value: '6px', label: 'Leve' }, { value: '8px', label: 'Padrão' },
          { value: '12px', label: 'Arredondado' }, { value: '999px', label: 'Pill' },
        ]} />
      </Field>
    </>}
    {['image'].includes(type) && <>
      <Field label="Border radius">
        <Select value={(p.borderRadius as string) || '12px'} onChange={v => set('borderRadius', v)} options={[
          { value: '0', label: 'Sem' }, { value: '8px', label: 'Leve' }, { value: '12px', label: 'Médio' }, { value: '20px', label: 'Grande' }, { value: '50%', label: 'Círculo' },
        ]} />
      </Field>
      <Field label="Sombra">
        <ToggleBtn active={p.shadow as boolean} onToggle={() => set('shadow', !p.shadow)} label="Sombra" />
      </Field>
    </>}
    {['badge'].includes(type) && <>
      <Field label="Cor de fundo"><ColorIn value={p.backgroundColor as string} set={v => set('backgroundColor', v)} /></Field>
      <Field label="Cor do texto"><ColorIn value={p.textColor as string} set={v => set('textColor', v)} /></Field>
    </>}
    {['divider'].includes(type) && (
      <Field label="Cor"><ColorIn value={p.color as string} set={v => set('color', v)} /></Field>
    )}
  </>
}

// ── Reusable field components ────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#777', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      {children}
    </div>
  )
}

function TextIn({ value, set, placeholder, style: extraStyle }: { value: unknown; set: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
  return (
    <input type="text" value={(value as string) || ''} onChange={e => set(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, ...extraStyle }} />
  )
}

function TextArea({ value, set, rows = 3 }: { value: unknown; set: (v: string) => void; rows?: number }) {
  return (
    <textarea value={(value as string) || ''} onChange={e => set(e.target.value)} rows={rows}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
  )
}

function ColorIn({ value, set }: { value: string; set: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="color" value={value || '#ffffff'} onChange={e => set(e.target.value)}
        style={{ width: 32, height: 32, border: '1px solid #2d2d4a', borderRadius: 6, background: 'none', cursor: 'pointer', padding: 2 }} />
      <input type="text" value={value || ''} onChange={e => set(e.target.value)}
        style={{ flex: 1, ...inputStyle }} placeholder="#000000" />
    </div>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function AlignButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[['left','◀'], ['center','■'], ['right','▶']].map(([v, icon]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          background: value === v ? '#6366f1' : '#0d0d1a', color: value === v ? '#fff' : '#666', fontSize: 12,
        }}>{icon}</button>
      ))}
    </div>
  )
}

function ToggleBtn({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} style={{
      padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      background: active ? '#6366f1' : '#0d0d1a', color: active ? '#fff' : '#666', fontSize: 12,
    }}>{active ? `✓ ${label} ativada` : `${label} desativada`}</button>
  )
}

// ── Array editor ─────────────────────────────────────────────────
interface ArrayFieldDef { key: string; label: string; type: 'text' | 'textarea' | 'color' | 'select' | 'checkbox'; options?: string[] }
interface ArrayEditorProps {
  label: string; items: Array<Record<string, unknown>>
  onChange: (items: Array<Record<string, unknown>>) => void
  defaultItem: Record<string, unknown>; fields: ArrayFieldDef[]
}

function ArrayEditor({ label, items, onChange, defaultItem, fields }: ArrayEditorProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const add = () => {
    onChange([...items, { ...defaultItem }])
    setExpandedIdx(items.length)
  }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, key: string, val: unknown) => {
    onChange(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }
  const move = (i: number, dir: number) => {
    const next = [...items]
    const target = i + dir
    if (target < 0 || target >= next.length) return
    ;[next[i], next[target]] = [next[target], next[i]]
    onChange(next)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#777', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label} ({items.length})</label>
        <button onClick={add} style={{ padding: '3px 10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>+ Adicionar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: '#0d0d1a', borderRadius: 8, border: '1px solid #2d2d4a', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6, cursor: 'pointer' }} onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}>
              <span style={{ flex: 1, fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(item.title || item.label || item.question || item.name || item.value || i + 1)}
              </span>
              <button onClick={e => { e.stopPropagation(); move(i, -1) }} disabled={i === 0} style={miniBtn}>↑</button>
              <button onClick={e => { e.stopPropagation(); move(i, 1) }} disabled={i === items.length - 1} style={miniBtn}>↓</button>
              <button onClick={e => { e.stopPropagation(); remove(i) }} style={{ ...miniBtn, background: '#7f1d1d', color: '#fca5a5' }}>✕</button>
              <span style={{ color: '#555', fontSize: 12 }}>{expandedIdx === i ? '▲' : '▼'}</span>
            </div>
            {expandedIdx === i && (
              <div style={{ padding: '4px 10px 12px', borderTop: '1px solid #2d2d4a' }}>
                {fields.map(f => (
                  <div key={f.key} style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontSize: 10, color: '#555', marginBottom: 3 }}>{f.label}</label>
                    {f.type === 'textarea'
                      ? <textarea value={(item[f.key] as string) || ''} onChange={e => update(i, f.key, e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontSize: 12 }} />
                      : f.type === 'color'
                        ? <ColorIn value={item[f.key] as string} set={v => update(i, f.key, v)} />
                        : f.type === 'select'
                          ? <select value={(item[f.key] as string) || ''} onChange={e => update(i, f.key, e.target.value)} style={{ ...inputStyle, fontSize: 12 }}>
                              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          : f.type === 'checkbox'
                            ? <input type="checkbox" checked={Boolean(item[f.key])} onChange={e => update(i, f.key, e.target.checked)} style={{ accentColor: '#6366f1' }} />
                            : <input type="text" value={(item[f.key] as string) || ''} onChange={e => update(i, f.key, e.target.value)} style={{ ...inputStyle, fontSize: 12 }} />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: '#0d0d1a',
  border: '1px solid #2d2d4a', borderRadius: 8, color: '#ccc',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const miniBtn: React.CSSProperties = {
  width: 22, height: 22, background: '#1e293b', border: 'none',
  borderRadius: 4, cursor: 'pointer', color: '#888', fontSize: 11, padding: 0, fontFamily: 'inherit',
}

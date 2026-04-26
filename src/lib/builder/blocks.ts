// Block type definitions and utilities for the page builder

export function nanoid(len = 8): string {
  return Math.random().toString(36).substring(2, 2 + len)
}

export type BlockType =
  | 'hero'
  | 'heading'
  | 'text'
  | 'button'
  | 'image'
  | 'video'
  | 'spacer'
  | 'divider'
  | 'features'
  | 'testimonial'
  | 'stats'
  | 'capture-form'
  | 'accordion'
  | 'gallery'
  | 'countdown'
  | 'badge'
  | 'cta-section'
  | 'social-proof'
  | 'timeline'
  | 'pricing'

export interface Block {
  id: string
  type: BlockType
  props: Record<string, unknown>
}

export interface PageConfig {
  primaryColor?: string
  backgroundColor?: string
  fontFamily?: string
  customCSS?: string
  seoTitle?: string
  seoDescription?: string
}

export interface Pagina {
  id: string
  nome: string
  slug: string
  descricao?: string
  conteudo: Block[]
  configuracoes: PageConfig
  publicada: boolean
  criado_em: string
  atualizado_em: string
}

// Default props for each block type
export const BLOCK_DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  hero: {
    eyebrow: 'Novidade',
    title: 'Título Principal da Sua Página',
    subtitle: 'Uma descrição convincente que explica o valor do seu produto ou serviço para o cliente.',
    ctaText: 'Começar Agora',
    ctaUrl: '#',
    ctaSecondaryText: 'Saiba Mais',
    ctaSecondaryUrl: '#',
    alignment: 'center',
    backgroundType: 'color',
    backgroundColor: '#0a0a0a',
    backgroundImage: '',
    textColor: '#ffffff',
    overlayOpacity: 0.5,
    minHeight: '90vh',
  },
  heading: {
    text: 'Seu Título Aqui',
    level: 'h2',
    alignment: 'center',
    color: '#111111',
    fontSize: '2.5rem',
    fontWeight: '700',
  },
  text: {
    content: 'Escreva seu texto aqui. Este parágrafo pode conter informações importantes sobre seu produto, serviço ou proposta de valor.',
    alignment: 'left',
    color: '#444444',
    fontSize: '1rem',
    maxWidth: '720px',
  },
  button: {
    text: 'Clique Aqui',
    url: '#',
    variant: 'primary',
    size: 'lg',
    alignment: 'center',
    backgroundColor: '#c2904d',
    textColor: '#ffffff',
    borderRadius: '8px',
    icon: '→',
  },
  image: {
    src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80',
    alt: 'Imagem',
    caption: '',
    borderRadius: '12px',
    maxWidth: '100%',
    alignment: 'center',
    shadow: true,
  },
  video: {
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    title: 'Vídeo',
    aspectRatio: '16/9',
    borderRadius: '12px',
  },
  spacer: { height: '60px' },
  divider: { style: 'solid', color: '#e5e7eb', thickness: '1px', width: '80%' },
  features: {
    title: 'Por Que Nos Escolher?',
    subtitle: 'Conheça os diferenciais que fazem toda a diferença',
    columns: 3,
    style: 'cards',
    items: [
      { icon: '⚡', title: 'Rápido', description: 'Resultados visíveis desde a primeira semana de uso.', color: '#f59e0b' },
      { icon: '🎯', title: 'Preciso', description: 'Metodologia comprovada com mais de 10.000 usuários.', color: '#10b981' },
      { icon: '🔒', title: 'Seguro', description: 'Seus dados protegidos com criptografia de ponta.', color: '#6366f1' },
    ],
  },
  testimonial: {
    quote: 'Este produto transformou completamente minha vida. Resultados incríveis em pouquíssimo tempo. Recomendo para todos!',
    author: 'Maria Silva',
    role: 'Empreendedora',
    company: 'Silva Negócios',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b732?w=100&q=80',
    rating: 5,
    backgroundColor: '#f9fafb',
    textColor: '#111111',
  },
  stats: {
    backgroundColor: '#111111',
    textColor: '#ffffff',
    accentColor: '#c2904d',
    columns: 3,
    items: [
      { value: '10.000', label: 'Clientes Ativos', prefix: '+', suffix: '' },
      { value: '98', label: 'Satisfação', prefix: '', suffix: '%' },
      { value: '5', label: 'Anos de Mercado', prefix: '', suffix: '+' },
    ],
  },
  'capture-form': {
    title: 'Acesse Grátis Agora',
    subtitle: 'Preencha abaixo e receba acesso imediato',
    ctaText: 'Quero Acesso Grátis →',
    backgroundColor: '#ffffff',
    successMessage: 'Perfeito! Verifique seu e-mail para continuar.',
    fields: [
      { name: 'nome', label: 'Seu nome', type: 'text', placeholder: 'João Silva', required: true },
      { name: 'email', label: 'Seu melhor e-mail', type: 'email', placeholder: 'joao@email.com', required: true },
      { name: 'whatsapp', label: 'WhatsApp', type: 'tel', placeholder: '(11) 99999-9999', required: false },
    ],
  },
  accordion: {
    title: 'Perguntas Frequentes',
    items: [
      { question: 'Como funciona o processo?', answer: 'O processo é simples e intuitivo. Você começa se cadastrando e em seguida tem acesso imediato a todo o conteúdo.' },
      { question: 'Quanto tempo leva para ver resultados?', answer: 'A maioria dos usuários começa a ver resultados significativos dentro das primeiras 2 semanas de uso consistente.' },
      { question: 'Existe garantia?', answer: 'Sim! Oferecemos garantia de 30 dias. Se não ficar satisfeito, devolvemos 100% do seu investimento.' },
    ],
  },
  gallery: {
    columns: 3,
    gap: '16px',
    borderRadius: '12px',
    images: [
      { src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80', alt: 'Imagem 1', caption: '' },
      { src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&q=80', alt: 'Imagem 2', caption: '' },
      { src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80', alt: 'Imagem 3', caption: '' },
    ],
  },
  countdown: {
    title: 'Oferta Encerra Em:',
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    backgroundColor: '#1a1a1a',
    textColor: '#ffffff',
    accentColor: '#c2904d',
  },
  badge: {
    text: '🔥 Novidade',
    icon: '',
    backgroundColor: '#fef3c7',
    textColor: '#92400e',
    size: 'md',
  },
  'cta-section': {
    title: 'Pronto Para Transformar Seus Resultados?',
    description: 'Junte-se a milhares de pessoas que já estão vivendo essa transformação. Comece hoje mesmo.',
    ctaText: 'Começar Agora — É Grátis',
    ctaUrl: '#',
    secondaryCta: 'Falar com Especialista',
    backgroundColor: '#c2904d',
    textColor: '#ffffff',
    pattern: 'dots',
  },
  'social-proof': {
    title: 'Presente em Mais de 50 Países',
    style: 'logos',
    logos: [
      { src: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg', alt: 'Google', url: '#' },
      { src: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', alt: 'Netflix', url: '#' },
    ],
  },
  timeline: {
    title: 'Como Funciona',
    items: [
      { step: '01', title: 'Cadastre-se', description: 'Crie sua conta gratuitamente em menos de 1 minuto.', icon: '✅' },
      { step: '02', title: 'Configure', description: 'Personalize de acordo com suas necessidades.', icon: '⚙️' },
      { step: '03', title: 'Colha os Frutos', description: 'Veja os resultados chegando dia após dia.', icon: '🚀' },
    ],
  },
  pricing: {
    title: 'Escolha Seu Plano',
    subtitle: 'Sem compromisso. Cancele quando quiser.',
    plans: [
      {
        name: 'Starter',
        price: 'Grátis',
        period: '',
        description: 'Para quem está começando',
        features: ['✅ 5 projetos', '✅ 1 GB de armazenamento', '✅ Suporte por e-mail'],
        ctaText: 'Começar Grátis',
        ctaUrl: '#',
        highlighted: false,
      },
      {
        name: 'Pro',
        price: 'R$ 97',
        period: '/mês',
        description: 'Para quem quer crescer',
        features: ['✅ Projetos ilimitados', '✅ 50 GB de armazenamento', '✅ Suporte prioritário', '✅ Analytics avançado'],
        ctaText: 'Assinar Pro',
        ctaUrl: '#',
        highlighted: true,
      },
    ],
  },
}

// Block metadata for the sidebar palette
export interface BlockMeta {
  type: BlockType
  label: string
  icon: string
  description: string
  category: 'layout' | 'content' | 'media' | 'interactive' | 'conversion'
}

export const BLOCK_META: BlockMeta[] = [
  { type: 'hero', label: 'Hero', icon: '🦸', description: 'Seção principal de impacto', category: 'layout' },
  { type: 'heading', label: 'Título', icon: '🔠', description: 'H1 a H6', category: 'content' },
  { type: 'text', label: 'Texto', icon: '📝', description: 'Parágrafo de texto', category: 'content' },
  { type: 'button', label: 'Botão', icon: '🔘', description: 'Botão de ação (CTA)', category: 'content' },
  { type: 'image', label: 'Imagem', icon: '🖼️', description: 'Imagem com legenda', category: 'media' },
  { type: 'video', label: 'Vídeo', icon: '▶️', description: 'Embed YouTube/Vimeo', category: 'media' },
  { type: 'gallery', label: 'Galeria', icon: '🎨', description: 'Grade de imagens', category: 'media' },
  { type: 'features', label: 'Features', icon: '✨', description: 'Grade de diferenciais', category: 'layout' },
  { type: 'stats', label: 'Estatísticas', icon: '📊', description: 'Números de impacto', category: 'content' },
  { type: 'testimonial', label: 'Depoimento', icon: '💬', description: 'Prova social individual', category: 'conversion' },
  { type: 'social-proof', label: 'Logos', icon: '🏆', description: 'Logos de clientes/parceiros', category: 'conversion' },
  { type: 'pricing', label: 'Preços', icon: '💰', description: 'Tabela de planos', category: 'conversion' },
  { type: 'capture-form', label: 'Formulário', icon: '📋', description: 'Captura de leads', category: 'conversion' },
  { type: 'cta-section', label: 'CTA Seção', icon: '🎯', description: 'Seção de chamada para ação', category: 'conversion' },
  { type: 'countdown', label: 'Contagem', icon: '⏱️', description: 'Contador regressivo', category: 'interactive' },
  { type: 'accordion', label: 'FAQ', icon: '❓', description: 'Perguntas e respostas', category: 'interactive' },
  { type: 'timeline', label: 'Linha do Tempo', icon: '📅', description: 'Passos do processo', category: 'content' },
  { type: 'badge', label: 'Badge', icon: '🏅', description: 'Etiqueta/destaque', category: 'content' },
  { type: 'divider', label: 'Divisor', icon: '➖', description: 'Linha horizontal', category: 'layout' },
  { type: 'spacer', label: 'Espaço', icon: '⬜', description: 'Espaço vertical', category: 'layout' },
]

export const BLOCK_CATEGORIES = [
  { key: 'layout', label: 'Layout', icon: '📐' },
  { key: 'content', label: 'Conteúdo', icon: '📝' },
  { key: 'media', label: 'Mídia', icon: '🖼️' },
  { key: 'conversion', label: 'Conversão', icon: '🎯' },
  { key: 'interactive', label: 'Interativo', icon: '⚡' },
] as const

export function createBlock(type: BlockType): Block {
  return {
    id: nanoid(),
    type,
    props: { ...BLOCK_DEFAULTS[type] },
  }
}

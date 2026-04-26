import { createAdminClient } from '@/lib/supabase/admin'
import PaginasList from './PaginasList'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Páginas — Maestria Social' }

export default async function PaginasPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('paginas')
    .select('id, nome, slug, descricao, publicada, criado_em, atualizado_em')
    .order('criado_em', { ascending: false })

  return <PaginasList paginasIniciais={data ?? []} />
}

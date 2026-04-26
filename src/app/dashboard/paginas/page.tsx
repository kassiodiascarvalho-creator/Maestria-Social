import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import PaginasList from './PaginasList'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Páginas — Maestria Social' }

const COOKIE = 'paginas_sid'
const TOKEN = 'b4cc9e1f-paginas-ok-7d3a'

export default async function PaginasPage() {
  const cookieStore = await cookies()
  if (cookieStore.get(COOKIE)?.value !== TOKEN) {
    redirect('/dashboard/paginas/gate')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { data } = await supabase
    .from('paginas')
    .select('id, nome, slug, descricao, publicada, criado_em, atualizado_em')
    .order('criado_em', { ascending: false })

  return <PaginasList paginasIniciais={data ?? []} />
}

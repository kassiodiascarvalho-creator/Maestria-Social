import { createAdminClient } from '@/lib/supabase/admin'
import EmailsClient from './EmailsClient'

export const dynamic = 'force-dynamic'

export default async function EmailsPage() {
  const db = createAdminClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  const [{ data: templates }, { data: listas }, { data: campanhas }] = await Promise.all([
    db.from('email_templates').select('*').order('pilar').order('dia'),
    db.from('email_listas').select('*').order('criado_em', { ascending: false }),
    db.from('email_campanhas').select('*, email_listas(nome)').order('criado_em', { ascending: false }).limit(50),
  ])

  return (
    <EmailsClient
      templates={templates ?? []}
      listasIniciais={listas ?? []}
      campanhasIniciais={campanhas ?? []}
    />
  )
}

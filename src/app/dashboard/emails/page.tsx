import { createAdminClient } from "@/lib/supabase/admin"
import EmailsClient from "./EmailsClient"

export default async function EmailsPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .order("pilar")
    .order("dia")

  return <EmailsClient templates={data ?? []} />
}

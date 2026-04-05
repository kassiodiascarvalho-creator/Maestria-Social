import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Cliente com service_role — uso exclusivo server-side (API Routes, Server Actions)
// NUNCA expor no browser
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — lista todos os templates agrupados
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('pilar')
    .order('dia')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

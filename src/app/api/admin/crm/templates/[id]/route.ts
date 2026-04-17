import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// DELETE — remove template
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('crm_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

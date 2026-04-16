import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: pessoas } = await admin
    .from('agenda_pessoas')
    .select('id, nome, bio, role, foto_url, foto_pos_x, foto_pos_y, foto_scale, slug, ativo, google_refresh_token')
    .order('criado_em', { ascending: false })

  const lista = (pessoas ?? []) as Array<{
    id: string; nome: string; bio: string; role: string
    foto_url: string | null; foto_pos_x: number; foto_pos_y: number; foto_scale: number
    slug: string; ativo: boolean; google_refresh_token: string | null
  }>

  return (
    <>
      <style>{css}</style>
      <div className="ag-page">
        <div className="ag-header">
          <div>
            <h1 className="ag-titulo">Agenda</h1>
            <p className="ag-sub">Gerencie mentores, coaches e colaboradores disponíveis para agendamento</p>
          </div>
          <Link href="/dashboard/agenda/nova" className="ag-novo-btn">+ Nova pessoa</Link>
        </div>

        {lista.length === 0 ? (
          <div className="ag-vazio">
            <div className="ag-vazio-icon">◷</div>
            <p className="ag-vazio-titulo">Nenhuma pessoa cadastrada</p>
            <p className="ag-vazio-sub">Adicione mentores, coaches ou colaboradores para começar a receber agendamentos.</p>
            <Link href="/dashboard/agenda/nova" className="ag-novo-btn">+ Adicionar pessoa</Link>
          </div>
        ) : (
          <div className="ag-grid">
            {lista.map(p => (
              <Link key={p.id} href={`/dashboard/agenda/${p.id}`} className="ag-card">
                <div className="ag-card-foto-wrap">
                  {p.foto_url ? (
                    <div className="ag-foto-circle">
                      <img
                        src={p.foto_url}
                        alt={p.nome}
                        style={{
                          position: 'absolute',
                          left: '50%', top: '50%',
                          transform: `translate(calc(-50% + ${p.foto_pos_x}px), calc(-50% + ${p.foto_pos_y}px)) scale(${p.foto_scale})`,
                          width: '160%', height: '160%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                  ) : (
                    <div className="ag-foto-circle ag-foto-placeholder">
                      {p.nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={`ag-status-dot ${p.ativo ? 'dot-on' : 'dot-off'}`} />
                </div>
                <div className="ag-card-info">
                  <span className="ag-card-nome">{p.nome}</span>
                  {p.role && <span className="ag-card-role">{p.role}</span>}
                  {p.bio && <p className="ag-card-bio">{p.bio.slice(0, 80)}{p.bio.length > 80 ? '…' : ''}</p>}
                  <div className="ag-card-footer">
                    <span className="ag-card-slug">/{p.slug}</span>
                    {p.google_refresh_token
                      ? <span className="ag-google-ok">● Google conectado</span>
                      : <span className="ag-google-no">○ Google não conectado</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

const css = `
  .ag-page{padding:32px;max-width:1100px;margin:0 auto;}
  .ag-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:32px;flex-wrap:wrap;}
  .ag-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:700;color:#fff9e6;margin-bottom:4px;}
  .ag-sub{font-size:13px;color:#4a3e30;line-height:1.5;}
  .ag-novo-btn{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:12px;padding:12px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block;transition:all .2s;white-space:nowrap;}
  .ag-novo-btn:hover{filter:brightness(1.08);transform:translateY(-1px);}
  .ag-vazio{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:80px 24px;text-align:center;}
  .ag-vazio-icon{font-size:48px;color:#2a1f18;}
  .ag-vazio-titulo{font-size:18px;font-weight:600;color:#fff9e6;}
  .ag-vazio-sub{font-size:14px;color:#4a3e30;max-width:400px;line-height:1.6;}
  .ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;}
  .ag-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:24px;display:flex;gap:16px;text-decoration:none;transition:all .2s;cursor:pointer;}
  .ag-card:hover{border-color:rgba(194,144,77,.3);background:#1e1812;}
  .ag-card-foto-wrap{position:relative;flex-shrink:0;}
  .ag-foto-circle{width:72px;height:72px;border-radius:50%;overflow:hidden;position:relative;background:#2a1f18;border:2px solid #2a1f18;flex-shrink:0;}
  .ag-foto-placeholder{display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#c2904d;font-family:'Cormorant Garamond',Georgia,serif;}
  .ag-status-dot{position:absolute;bottom:2px;right:2px;width:12px;height:12px;border-radius:50%;border:2px solid #1a1410;}
  .dot-on{background:#6acca0;}
  .dot-off{background:#4a3e30;}
  .ag-card-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}
  .ag-card-nome{font-size:16px;font-weight:700;color:#fff9e6;font-family:'Cormorant Garamond',Georgia,serif;}
  .ag-card-role{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2904d;}
  .ag-card-bio{font-size:12px;color:#7a6e5e;line-height:1.5;margin:2px 0;font-weight:300;}
  .ag-card-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:8px;border-top:1px solid #2a1f18;flex-wrap:wrap;}
  .ag-card-slug{font-size:11px;color:#4a3e30;font-family:monospace;}
  .ag-google-ok{font-size:11px;color:#6acca0;}
  .ag-google-no{font-size:11px;color:#4a3e30;}
  @media(max-width:600px){.ag-page{padding:20px;}.ag-grid{grid-template-columns:1fr;}}
`

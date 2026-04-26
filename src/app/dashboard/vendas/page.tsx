'use client'

import { useState, useEffect, useCallback } from 'react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN = (v: number) => v.toLocaleString('pt-BR')

type Venda = {
  id: string; plataforma: string; produto_nome?: string; valor: number
  status: string; comprador_nome?: string; comprador_email?: string
  utm_source?: string; transaction_id?: string; criado_em: string
}

type Dados = {
  vendas: Venda[]
  totais: { vendas: number; receita: number; ticket_medio: number; canceladas: number; reembolsadas: number }
  receitaHoje: number
  porPlataforma: Record<string, { vendas: number; receita: number }>
  porProduto: [string, { vendas: number; receita: number }][]
  porFonte: [string, number][]
  porDia: [string, { vendas: number; receita: number }][]
}

const STATUS_COR: Record<string, string> = { aprovado: '#10b981', cancelado: '#ef4444', reembolsado: '#f59e0b', chargeback: '#dc2626', pendente: '#6b7280' }
const PLAT_ICON: Record<string, string> = { hotmart: '🔥', kiwify: '🥝', eduzz: '📦', hubla: '🌐', lastlink: '🔗', cakto: '🍰', monetizze: '💳', ticto: '✅', manual: '✏️' }

function Card({ label, value, sub, cor }: { label: string; value: string; sub?: string; cor?: string }) {
  return (
    <div style={{ background: '#111009', border: '1px solid #2a1f18', borderRadius: 14, padding: '20px 24px', minWidth: 160 }}>
      <div style={{ fontSize: 11, color: '#4a3e30', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: cor || '#c2904d', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4a3e30', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default function VendasPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('30')
  const [plataformaFiltro, setPlataformaFiltro] = useState('todas')
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({ email: '', nome: '', produto_nome: '', valor: '', transaction_id: '' })
  const [savingManual, setSavingManual] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/vendas?periodo=${periodo}`)
    if (res.ok) setDados(await res.json())
    setLoading(false)
  }, [periodo])

  useEffect(() => { carregar() }, [carregar])

  async function salvarManual() {
    if (!manual.email.trim()) return
    setSavingManual(true)
    await fetch('/api/admin/vendas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...manual, valor: parseFloat(manual.valor) || 0 }) })
    setShowManual(false); setManual({ email: '', nome: '', produto_nome: '', valor: '', transaction_id: '' })
    carregar(); setSavingManual(false)
  }

  return (
    <>
      <style>{css}</style>
      <div className='vd-wrap'>
        <div className='vd-header'>
          <div>
            <h1 className='vd-title'>💰 Vendas</h1>
            <p className='vd-sub'>Receita e conversões por plataforma</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className='vd-select' value={plataformaFiltro} onChange={e => setPlataformaFiltro(e.target.value)}>
              <option value='todas'>Todas as plataformas</option>
              <option value='hotmart'>🔥 Hotmart</option>
              <option value='kiwify'>🥝 Kiwify</option>
              <option value='eduzz'>📦 Eduzz</option>
              <option value='hubla'>🌐 Hubla</option>
              <option value='lastlink'>🔗 Lastlink</option>
              <option value='cakto'>🍰 Cakto</option>
              <option value='monetizze'>💳 Monetizze</option>
              <option value='ticto'>✅ Ticto</option>
              <option value='manual'>✏️ Manual</option>
            </select>
            <select className='vd-select' value={periodo} onChange={e => setPeriodo(e.target.value)}>
              <option value='7'>Últimos 7 dias</option>
              <option value='30'>Últimos 30 dias</option>
              <option value='90'>Últimos 90 dias</option>
              <option value='365'>Último ano</option>
            </select>
            <button className='vd-btn vd-btn-ghost' onClick={carregar}>↺ Atualizar</button>
            <button className='vd-btn vd-btn-primary' onClick={() => setShowManual(true)}>+ Venda manual</button>
          </div>
        </div>

        {loading ? <div className='vd-loading'>Carregando...</div> : dados ? (
          <>
            {/* KPIs */}
            <div className='vd-kpis'>
              <Card label='Receita total' value={fmt(dados.totais.receita)} sub={`${fmtN(dados.totais.vendas)} vendas`} />
              <Card label='Hoje' value={fmt(dados.receitaHoje)} cor='#10b981' />
              <Card label='Ticket médio' value={fmt(dados.totais.ticket_medio)} cor='#6366f1' />
              <Card label='Canceladas' value={fmtN(dados.totais.canceladas)} cor='#ef4444' />
              <Card label='Reembolsos' value={fmtN(dados.totais.reembolsadas)} cor='#f59e0b' />
            </div>

            <div className='vd-grid2'>
              {/* Por plataforma */}
              <div className='vd-card'>
                <h3 className='vd-card-title'>Por plataforma</h3>
                {Object.entries(dados.porPlataforma).map(([plat, d]) => (
                  <div key={plat} className='vd-row'>
                    <span style={{ fontSize: 16 }}>{PLAT_ICON[plat] || '📦'}</span>
                    <span style={{ flex: 1, color: '#c8b99a', fontWeight: 600, textTransform: 'capitalize' }}>{plat}</span>
                    <span style={{ color: '#4a3e30', fontSize: 12 }}>{d.vendas} vendas</span>
                    <span style={{ color: '#c2904d', fontWeight: 700 }}>{fmt(d.receita)}</span>
                  </div>
                ))}
                {!Object.keys(dados.porPlataforma).length && <p className='vd-empty'>Nenhuma venda aprovada</p>}
              </div>

              {/* Por fonte UTM */}
              <div className='vd-card'>
                <h3 className='vd-card-title'>Por origem (UTM Source)</h3>
                {dados.porFonte.map(([fonte, qtd]) => (
                  <div key={fonte} className='vd-row'>
                    <span style={{ flex: 1, color: '#c8b99a' }}>{fonte}</span>
                    <span style={{ background: 'rgba(194,144,77,.1)', color: '#c2904d', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{qtd} vendas</span>
                  </div>
                ))}
                {!dados.porFonte.length && <p className='vd-empty'>Sem dados de UTM</p>}
              </div>

              {/* Top produtos */}
              <div className='vd-card'>
                <h3 className='vd-card-title'>Top produtos</h3>
                {dados.porProduto.map(([nome, d]) => (
                  <div key={nome} className='vd-row'>
                    <span style={{ flex: 1, color: '#c8b99a', fontSize: 13 }}>{nome}</span>
                    <span style={{ color: '#4a3e30', fontSize: 12, marginRight: 12 }}>{d.vendas}×</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(d.receita)}</span>
                  </div>
                ))}
                {!dados.porProduto.length && <p className='vd-empty'>Nenhuma venda aprovada</p>}
              </div>

              {/* Evolução */}
              <div className='vd-card'>
                <h3 className='vd-card-title'>Evolução diária (receita)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                  {dados.porDia.slice(-15).reverse().map(([dia, d]) => (
                    <div key={dia} className='vd-row'>
                      <span style={{ color: '#4a3e30', fontSize: 12, minWidth: 90 }}>{new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      <div style={{ flex: 1, background: '#1a1410', borderRadius: 4, height: 6, overflow: 'hidden', margin: '0 12px' }}>
                        <div style={{ height: '100%', background: '#c2904d', width: dados.totais.receita > 0 ? `${Math.min(100, (d.receita / dados.totais.receita) * 100 * 10)}%` : '0%', borderRadius: 4 }} />
                      </div>
                      <span style={{ color: '#c2904d', fontWeight: 700, fontSize: 13, minWidth: 80, textAlign: 'right' }}>{fmt(d.receita)}</span>
                    </div>
                  ))}
                  {!dados.porDia.length && <p className='vd-empty'>Sem dados</p>}
                </div>
              </div>
            </div>

            {/* Lista de transações */}
            <div className='vd-card' style={{ marginTop: 24 }}>
              <h3 className='vd-card-title'>Transações recentes</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2a1f18' }}>
                      {['Plataforma', 'Comprador', 'Produto', 'Valor', 'Status', 'Origem', 'Data'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', color: '#4a3e30', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.vendas.filter(v => plataformaFiltro === 'todas' || v.plataforma === plataformaFiltro).slice(0, 50).map(v => (
                      <tr key={v.id} style={{ borderBottom: '1px solid #1a1410' }}>
                        <td style={{ padding: '10px 12px' }}><span title={v.plataforma}>{PLAT_ICON[v.plataforma] || '📦'} {v.plataforma}</span></td>
                        <td style={{ padding: '10px 12px', color: '#c8b99a' }}>
                          <div style={{ fontWeight: 600 }}>{v.comprador_nome || '—'}</div>
                          <div style={{ fontSize: 11, color: '#4a3e30' }}>{v.comprador_email}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#7a6e5e', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.produto_nome || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#c2904d', fontWeight: 700 }}>{fmt(Number(v.valor || 0))}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${STATUS_COR[v.status]}20`, color: STATUS_COR[v.status], fontWeight: 700 }}>{v.status}</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#4a3e30', fontSize: 12 }}>{v.utm_source || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#4a3e30', fontSize: 12 }}>{new Date(v.criado_em).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!dados.vendas.length && <p className='vd-empty' style={{ padding: 32, textAlign: 'center' }}>Nenhuma transação no período</p>}
              </div>
            </div>
          </>
        ) : <p style={{ color: '#4a3e30' }}>Erro ao carregar dados</p>}

        {/* Modal venda manual */}
        {showManual && (
          <div className='vd-overlay' onClick={() => setShowManual(false)}>
            <div className='vd-modal' onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ color: '#fff9e6', fontSize: 18, fontWeight: 800, margin: 0 }}>Registrar Venda Manual</h2>
                <button onClick={() => setShowManual(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 20 }}>✕</button>
              </div>
              {[
                { label: 'E-mail do comprador *', key: 'email', placeholder: 'comprador@email.com', type: 'email' },
                { label: 'Nome', key: 'nome', placeholder: 'Nome completo', type: 'text' },
                { label: 'Produto', key: 'produto_nome', placeholder: 'Nome do produto', type: 'text' },
                { label: 'Valor (R$)', key: 'valor', placeholder: '997.00', type: 'number' },
                { label: 'ID da transação', key: 'transaction_id', placeholder: 'Opcional', type: 'text' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4a3e30', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</label>
                  <input type={f.type} value={manual[f.key as keyof typeof manual]} onChange={e => setManual(m => ({ ...m, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className='vd-input' />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className='vd-btn vd-btn-primary' style={{ flex: 1 }} onClick={salvarManual} disabled={savingManual}>{savingManual ? 'Salvando...' : 'Registrar Venda'}</button>
                <button className='vd-btn vd-btn-ghost' onClick={() => setShowManual(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const css = `
  .vd-wrap{padding:32px;max-width:1200px;font-family:Inter,system-ui,sans-serif;}
  .vd-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;flex-wrap:wrap;gap:16px;}
  .vd-title{font-size:28px;font-weight:900;color:#fff9e6;margin:0 0 4px;}
  .vd-sub{font-size:13px;color:#4a3e30;margin:0;}
  .vd-select{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:8px 12px;color:#c8b99a;font-size:13px;font-family:inherit;outline:none;cursor:pointer;}
  .vd-btn{padding:9px 18px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:none;transition:filter .15s;}
  .vd-btn:disabled{opacity:.4;cursor:default;}
  .vd-btn-primary{background:rgba(194,144,77,.15);border:1px solid rgba(194,144,77,.3);color:#c2904d;}
  .vd-btn-ghost{background:transparent;border:1px solid #2a1f18;color:#7a6e5e;}
  .vd-btn-ghost:hover{color:#fff9e6;}
  .vd-kpis{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;}
  .vd-card{background:#111009;border:1px solid #2a1f18;border-radius:14px;padding:20px 24px;}
  .vd-card-title{font-size:13px;font-weight:700;color:#7a6e5e;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;}
  .vd-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;}
  .vd-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1a1410;}
  .vd-row:last-child{border-bottom:none;}
  .vd-empty{color:#4a3e30;font-size:13px;text-align:center;padding:20px 0;margin:0;}
  .vd-loading{color:#4a3e30;padding:40px;text-align:center;}
.vd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;}
  .vd-modal{background:#111009;border:1px solid #2a1f18;border-radius:18px;padding:28px;width:100%;max-width:440px;box-shadow:0 24px 80px rgba(0,0,0,.5);}
  .vd-input{width:100%;background:#1a1410;border:1px solid #2a1f18;border-radius:8px;padding:10px 12px;color:#fff9e6;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;}
  .vd-input:focus{border-color:rgba(194,144,77,.35);}
  @media(max-width:768px){.vd-wrap{padding:16px;}.vd-kpis{flex-direction:column;}}
`

"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { PessoaDB } from './page'

type Props = { pessoa: PessoaDB | null; googleStatus?: string }

type AgenteOpcao = { id: string; nome: string; ativo: boolean }

const ROLES = ['Mentor', 'Coach', 'Colaborador', 'Especialista', 'Consultor']
const DURACOES = [15, 20, 30, 45, 60, 90]

export default function AgendaEditor({ pessoa, googleStatus }: Props) {
  const router = useRouter()
  const isNova = !pessoa

  const [nome, setNome] = useState(pessoa?.nome ?? '')
  const [bio, setBio] = useState(pessoa?.bio ?? '')
  const [role, setRole] = useState(pessoa?.role ?? '')
  const [email, setEmail] = useState(pessoa?.email ?? '')
  const [duracao, setDuracao] = useState(pessoa?.duracao_slot ?? 30)
  const [ativo, setAtivo] = useState(pessoa?.ativo ?? true)
  const [slug, setSlug] = useState(pessoa?.slug ?? '')
  const [agenteId, setAgenteId] = useState<string>((pessoa as Record<string, unknown> | null)?.agente_id as string ?? '')
  const [agentes, setAgentes] = useState<AgenteOpcao[]>([])

  useEffect(() => {
    fetch('/api/admin/agentes')
      .then(r => r.json())
      .then((data: AgenteOpcao[]) => { if (Array.isArray(data)) setAgentes(data) })
      .catch(() => {})
  }, [])

  // Foto
  const [fotoUrl, setFotoUrl] = useState(pessoa?.foto_url ?? null)
  const [posX, setPosX] = useState(pessoa?.foto_pos_x ?? 0)
  const [posY, setPosY] = useState(pessoa?.foto_pos_y ?? 0)
  const [scale, setScale] = useState(pessoa?.foto_scale ?? 1)
  const [uploading, setUploading] = useState(false)
  const [fotoVersion, setFotoVersion] = useState(Date.now())
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [erro, setErro] = useState('')

  // Alerta Google OAuth
  const [googleMsg, setGoogleMsg] = useState('')
  useEffect(() => {
    if (googleStatus === 'ok') setGoogleMsg('✓ Google Calendar conectado com sucesso!')
    else if (googleStatus === 'erro') setGoogleMsg('Erro ao conectar Google. Tente novamente.')
    else if (googleStatus === 'sem_config') setGoogleMsg('Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas Integrações.')
    else if (googleStatus === 'sem_refresh') setGoogleMsg('Google não retornou token de atualização. Remova o acesso em myaccount.google.com e tente novamente.')
  }, [googleStatus])

  // ── Foto drag ───────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!fotoUrl) return
    e.preventDefault()
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, posX, posY }
  }, [fotoUrl, posX, posY])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPosX(dragStart.current.posX + dx)
    setPosY(dragStart.current.posY + dy)
  }, [dragging])

  const onMouseUp = useCallback(() => setDragging(false), [])

  // Touch
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!fotoUrl) return
    const t = e.touches[0]
    setDragging(true)
    dragStart.current = { x: t.clientX, y: t.clientY, posX, posY }
  }, [fotoUrl, posX, posY])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return
    const t = e.touches[0]
    setPosX(dragStart.current.posX + t.clientX - dragStart.current.x)
    setPosY(dragStart.current.posY + t.clientY - dragStart.current.y)
  }, [dragging])

  // ── Upload foto ──────────────────────────────────────────────────────────────
  async function uploadFoto(file: File) {
    if (!pessoa?.id) { setErro('Salve a pessoa antes de enviar a foto.'); return }
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/admin/agenda/pessoas/${pessoa.id}/foto`, { method: 'POST', body: form })
    const data = await res.json() as { url?: string; error?: string }
    if (!res.ok) { setErro(data.error ?? 'Erro ao enviar foto'); setUploading(false); return }
    setFotoUrl(data.url!)
    setFotoVersion(Date.now())
    setPosX(0); setPosY(0); setScale(1)
    setUploading(false)
  }

  // ── Salvar ───────────────────────────────────────────────────────────────────
  async function salvar() {
    if (!nome.trim()) { setErro('Nome é obrigatório'); return }
    setSaving(true); setErro('')
    const body = { nome, bio, role, email, duracao_slot: duracao, ativo, slug, foto_url: fotoUrl, foto_pos_x: posX, foto_pos_y: posY, foto_scale: scale, agente_id: agenteId || null }

    let res: Response
    if (isNova) {
      res = await fetch('/api/admin/agenda/pessoas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      res = await fetch(`/api/admin/agenda/pessoas/${pessoa.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }

    const data = await res.json() as { id?: string; error?: string }
    if (!res.ok) { setErro(data.error ?? 'Erro ao salvar'); setSaving(false); return }

    if (isNova && data.id) {
      router.push(`/dashboard/agenda/${data.id}`)
      return
    }
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    router.refresh()
    setSaving(false)
  }

  // ── Excluir ──────────────────────────────────────────────────────────────────
  async function excluir() {
    if (!pessoa?.id) return
    setExcluindo(true)
    const res = await fetch(`/api/admin/agenda/pessoas/${pessoa.id}`, { method: 'DELETE' })
    if (res.ok) { router.push('/dashboard/agenda') } else { setExcluindo(false); setConfirmarExclusao(false) }
  }

  const googleConectado = !!pessoa?.google_refresh_token

  return (
    <>
      <style>{css}</style>
      <div className="ed-root">
        {/* Header */}
        <div className="ed-header">
          <button className="ed-back" onClick={() => router.push('/dashboard/agenda')}>← Agenda</button>
          <h1 className="ed-titulo">{isNova ? 'Nova pessoa' : nome || 'Editar'}</h1>
          <div className="ed-actions">
            {!isNova && (
              <button className="ed-excluir" onClick={() => setConfirmarExclusao(true)} disabled={excluindo}>Excluir</button>
            )}
            <button className="ed-salvar" onClick={salvar} disabled={saving}>
              {saving ? 'Salvando…' : saved ? '✓ Salvo' : isNova ? 'Criar pessoa' : 'Salvar'}
            </button>
          </div>
        </div>

        {erro && <div className="ed-erro">{erro}</div>}
        {googleMsg && (
          <div className={`ed-google-msg ${googleStatus === 'ok' ? 'msg-ok' : 'msg-err'}`}>
            {googleMsg}
          </div>
        )}
        {confirmarExclusao && (
          <div className="ed-confirm">
            <p>Excluir <strong>{nome}</strong> e todos os agendamentos?</p>
            <div className="ed-confirm-btns">
              <button onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
              <button className="btn-danger" onClick={excluir} disabled={excluindo}>
                {excluindo ? 'Excluindo…' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        )}

        <div className="ed-body">
          {/* Coluna esquerda — foto */}
          <div className="ed-col-foto">
            <div className="ed-card">
              <div className="ed-label">Foto</div>
              <p className="ed-desc">Arraste a foto para centralizar o rosto. Use o zoom para ajustar.</p>

              {/* Círculo com drag */}
              <div
                className="ed-foto-container"
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchMove={onTouchMove}
                onTouchEnd={onMouseUp}
              >
                <div className="ed-foto-circle">
                  {fotoUrl ? (
                    <img
                      src={`${fotoUrl}?v=${fotoVersion}`}
                      alt="foto"
                      draggable={false}
                      onMouseDown={onMouseDown}
                      onTouchStart={onTouchStart}
                      style={{
                        position: 'absolute',
                        left: '50%', top: '50%',
                        transform: `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`,
                        width: '200%', height: '200%',
                        objectFit: 'cover',
                        cursor: dragging ? 'grabbing' : 'grab',
                        userSelect: 'none',
                      }}
                    />
                  ) : (
                    <div className="ed-foto-placeholder">
                      {nome ? nome.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                </div>
                {fotoUrl && <p className="ed-drag-hint">Arraste para reposicionar</p>}
              </div>

              {/* Zoom */}
              {fotoUrl && (
                <div className="ed-zoom-row">
                  <span className="ed-zoom-label">Zoom</span>
                  <input
                    type="range" min="0.5" max="3" step="0.05"
                    value={scale}
                    onChange={e => setScale(parseFloat(e.target.value))}
                    className="ed-slider"
                  />
                  <span className="ed-zoom-val">{scale.toFixed(1)}×</span>
                </div>
              )}

              {/* Upload */}
              <label className="ed-upload-btn">
                {uploading ? 'Enviando…' : fotoUrl ? 'Trocar foto' : 'Enviar foto'}
                <input
                  type="file" accept="image/*" hidden
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f) }}
                  disabled={uploading}
                />
              </label>
              {isNova && !pessoa && (
                <p className="ed-upload-hint">Salve a pessoa primeiro para enviar a foto.</p>
              )}
            </div>

            {/* Google Calendar */}
            {!isNova && (
              <div className="ed-card">
                <div className="ed-label">Google Calendar</div>
                <p className="ed-desc">
                  {googleConectado
                    ? 'Conta Google conectada. Reuniões serão criadas automaticamente no calendário desta pessoa.'
                    : 'Conecte a conta Google para criar eventos no Google Meet automaticamente.'}
                </p>
                <div className={`ed-google-status ${googleConectado ? 'gs-ok' : 'gs-no'}`}>
                  {googleConectado ? '● Conectado' : '○ Não conectado'}
                </div>
                <a
                  href={`/api/agenda/google/connect?pessoaId=${pessoa?.id}`}
                  className="ed-google-btn"
                >
                  {googleConectado ? '↺ Reconectar Google' : '+ Conectar Google Calendar'}
                </a>
              </div>
            )}
          </div>

          {/* Coluna direita — dados */}
          <div className="ed-col-dados">
            <div className="ed-card">
              <div className="ed-label">Identidade</div>
              <div className="ed-field">
                <label className="ed-field-label">Nome *</label>
                <input className="ed-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="ed-field">
                <label className="ed-field-label">Função / Cargo</label>
                <div className="ed-role-row">
                  <input className="ed-input" value={role} onChange={e => setRole(e.target.value)} placeholder="Ex: Mentor, Coach…" />
                  <div className="ed-role-chips">
                    {ROLES.map(r => (
                      <button key={r} className={`ed-chip ${role === r ? 'chip-on' : ''}`} onClick={() => setRole(r)} type="button">{r}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="ed-field">
                <label className="ed-field-label">Bio</label>
                <textarea className="ed-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="Breve descrição…" rows={3} />
              </div>
              <div className="ed-field">
                <label className="ed-field-label">E-mail (para Google Calendar)</label>
                <input className="ed-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@gmail.com" />
              </div>
            </div>

            <div className="ed-card">
              <div className="ed-label">Configurações</div>
              <div className="ed-field">
                <label className="ed-field-label">Duração de cada sessão</label>
                <div className="ed-duracao-row">
                  {DURACOES.map(d => (
                    <button key={d} className={`ed-chip ${duracao === d ? 'chip-on' : ''}`} onClick={() => setDuracao(d)} type="button">{d} min</button>
                  ))}
                  <div className={`ed-chip-custom ${!DURACOES.includes(duracao) ? 'chip-on' : ''}`}>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={DURACOES.includes(duracao) ? '' : duracao}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v) && v > 0) setDuracao(v)
                        else if (e.target.value === '') setDuracao(0)
                      }}
                      placeholder="Outro"
                      className="ed-chip-custom-input"
                    />
                    <span className="ed-chip-custom-suffix">min</span>
                  </div>
                </div>
              </div>
              <div className="ed-field">
                <label className="ed-field-label">Link público</label>
                <div className="ed-slug-row">
                  <span className="ed-slug-prefix">/agendar/</span>
                  <input className="ed-input ed-slug-input" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="seu-nome" />
                </div>
                {slug && (
                  <a href={`/agendar/${slug}`} target="_blank" rel="noreferrer" className="ed-slug-link">
                    Abrir página pública →
                  </a>
                )}
              </div>
              <div className="ed-field">
                <label className="ed-field-label">Agente SDR vinculado</label>
                <p className="ed-desc" style={{margin:0}}>O agente vinculado consulta sua disponibilidade em tempo real e agenda diretamente pelo WhatsApp — sem precisar que o lead acesse um link externo.</p>
                <select
                  className="ed-input ed-select"
                  value={agenteId}
                  onChange={e => setAgenteId(e.target.value)}
                >
                  <option value="">— Nenhum agente vinculado —</option>
                  {agentes.map(ag => (
                    <option key={ag.id} value={ag.id}>
                      {ag.nome}{!ag.ativo ? ' (inativo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ed-field">
                <label className="ed-field-label">Status</label>
                <div className="ed-toggle-row">
                  <button className={`ed-toggle ${ativo ? 'tog-on' : 'tog-off'}`} onClick={() => setAtivo(!ativo)} type="button">
                    <span className="tog-knob" />
                  </button>
                  <span className="ed-toggle-label">{ativo ? 'Ativo — aparece na página pública' : 'Inativo — oculto do público'}</span>
                </div>
              </div>
            </div>

            {!isNova && (
              <div className="ed-card">
                <div className="ed-label">Próximos passos</div>
                <div className="ed-links">
                  <a href={`/dashboard/agenda/${pessoa?.id}/horarios`} className="ed-link-card">
                    <span className="ed-link-icon">◷</span>
                    <div>
                      <div className="ed-link-titulo">Configurar horários</div>
                      <div className="ed-link-desc">Grade semanal de disponibilidade</div>
                    </div>
                    <span className="ed-link-arrow">→</span>
                  </a>
                  <a href={`/dashboard/agenda/${pessoa?.id}/disponibilidade`} className="ed-link-card">
                    <span className="ed-link-icon">◫</span>
                    <div>
                      <div className="ed-link-titulo">Disponibilidade</div>
                      <div className="ed-link-desc">Bloqueios e exceções no calendário</div>
                    </div>
                    <span className="ed-link-arrow">→</span>
                  </a>
                  <a href={`/dashboard/agenda/${pessoa?.id}/campos`} className="ed-link-card">
                    <span className="ed-link-icon">◧</span>
                    <div>
                      <div className="ed-link-titulo">Campos do formulário</div>
                      <div className="ed-link-desc">Personalize o que o lead preenche</div>
                    </div>
                    <span className="ed-link-arrow">→</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const css = `
  .ed-root{padding:28px 32px;max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:20px;}
  .ed-header{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
  .ed-back{background:none;border:none;color:#7a6e5e;font-size:14px;cursor:pointer;font-family:inherit;padding:0;transition:color .15s;}
  .ed-back:hover{color:#c2904d;}
  .ed-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:700;color:#fff9e6;flex:1;}
  .ed-actions{display:flex;gap:10px;align-items:center;}
  .ed-salvar{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:10px;padding:11px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;}
  .ed-salvar:hover:not(:disabled){filter:brightness(1.08);}
  .ed-salvar:disabled{opacity:.6;cursor:not-allowed;}
  .ed-excluir{background:none;border:1px solid rgba(224,88,64,.3);border-radius:10px;padding:10px 18px;font-size:13px;font-weight:600;color:#e07070;cursor:pointer;font-family:inherit;transition:all .15s;}
  .ed-excluir:hover:not(:disabled){background:rgba(224,88,64,.08);}
  .ed-erro{background:rgba(224,88,64,.1);border:1px solid rgba(224,88,64,.3);border-radius:10px;padding:12px 16px;font-size:14px;color:#e05840;}
  .ed-google-msg{border-radius:10px;padding:12px 16px;font-size:14px;}
  .msg-ok{background:rgba(106,204,160,.1);border:1px solid rgba(106,204,160,.3);color:#6acca0;}
  .msg-err{background:rgba(224,88,64,.1);border:1px solid rgba(224,88,64,.3);color:#e05840;}
  .ed-confirm{background:#1a1410;border:1px solid rgba(224,88,64,.3);border-radius:12px;padding:20px 24px;}
  .ed-confirm p{font-size:14px;color:#fff9e6;margin-bottom:14px;}
  .ed-confirm strong{color:#e07070;}
  .ed-confirm-btns{display:flex;gap:10px;}
  .ed-confirm-btns button{border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid #2a1f18;background:rgba(255,255,255,.03);color:#7a6e5e;}
  .btn-danger{background:rgba(224,88,64,.15)!important;border-color:rgba(224,88,64,.4)!important;color:#e05840!important;}
  .ed-body{display:grid;grid-template-columns:260px 1fr;gap:20px;align-items:start;}
  .ed-col-foto{display:flex;flex-direction:column;gap:16px;}
  .ed-col-dados{display:flex;flex-direction:column;gap:16px;}
  .ed-card{background:#1a1410;border:1px solid #2a1f18;border-radius:16px;padding:22px 24px;display:flex;flex-direction:column;gap:14px;}
  .ed-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a3e30;}
  .ed-desc{font-size:12px;color:#7a6e5e;line-height:1.6;font-weight:300;}
  .ed-foto-container{display:flex;flex-direction:column;align-items:center;gap:8px;user-select:none;}
  .ed-foto-circle{width:140px;height:140px;border-radius:50%;overflow:hidden;position:relative;background:#2a1f18;border:2px solid #3a2f28;cursor:grab;}
  .ed-foto-circle:active{cursor:grabbing;}
  .ed-foto-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:700;color:#c2904d;font-family:'Cormorant Garamond',Georgia,serif;}
  .ed-drag-hint{font-size:11px;color:#4a3e30;text-align:center;}
  .ed-zoom-row{display:flex;align-items:center;gap:10px;width:100%;}
  .ed-zoom-label{font-size:11px;color:#4a3e30;white-space:nowrap;}
  .ed-slider{flex:1;accent-color:#c2904d;cursor:pointer;}
  .ed-zoom-val{font-size:11px;color:#c2904d;font-family:monospace;width:28px;text-align:right;}
  .ed-upload-btn{display:block;text-align:center;background:rgba(194,144,77,.08);border:1px dashed rgba(194,144,77,.3);border-radius:10px;padding:10px;font-size:13px;color:#c2904d;cursor:pointer;transition:all .15s;}
  .ed-upload-btn:hover{background:rgba(194,144,77,.14);}
  .ed-upload-hint{font-size:11px;color:#4a3e30;text-align:center;}
  .ed-google-status{font-size:12px;font-weight:600;}
  .gs-ok{color:#6acca0;}
  .gs-no{color:#4a3e30;}
  .ed-google-btn{display:block;text-align:center;background:rgba(255,255,255,.04);border:1px solid #2a1f18;border-radius:10px;padding:10px 16px;font-size:13px;color:#fff9e6;text-decoration:none;transition:all .15s;}
  .ed-google-btn:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .ed-field{display:flex;flex-direction:column;gap:6px;}
  .ed-field-label{font-size:11px;font-weight:600;color:#7a6e5e;letter-spacing:.5px;}
  .ed-input{background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:10px 14px;font-size:14px;color:#fff9e6;font-family:inherit;outline:none;transition:border-color .2s;width:100%;}
  .ed-input:focus{border-color:rgba(194,144,77,.4);}
  .ed-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a3e30' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;cursor:pointer;}
  .ed-select option{background:#1a1410;color:#fff9e6;}
  .ed-textarea{background:#111009;border:1px solid #2a1f18;border-radius:10px;padding:10px 14px;font-size:14px;color:#fff9e6;font-family:inherit;outline:none;resize:vertical;transition:border-color .2s;width:100%;}
  .ed-textarea:focus{border-color:rgba(194,144,77,.4);}
  .ed-role-row{display:flex;flex-direction:column;gap:8px;}
  .ed-role-chips{display:flex;flex-wrap:wrap;gap:6px;}
  .ed-chip{background:rgba(255,255,255,.03);border:1px solid #2a1f18;border-radius:20px;padding:4px 12px;font-size:12px;color:#7a6e5e;cursor:pointer;font-family:inherit;transition:all .15s;}
  .ed-chip:hover{border-color:rgba(194,144,77,.3);color:#c2904d;}
  .chip-on{background:rgba(194,144,77,.1)!important;border-color:rgba(194,144,77,.4)!important;color:#c2904d!important;font-weight:600;}
  .ed-duracao-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
  .ed-chip-custom{display:inline-flex;align-items:center;gap:4px;background:transparent;border:1px solid #2a1f18;border-radius:8px;padding:0 10px;height:32px;transition:border-color .15s,color .15s;}
  .ed-chip-custom:hover{border-color:rgba(194,144,77,.3);}
  .ed-chip-custom.chip-on{background:rgba(194,144,77,.1);border-color:rgba(194,144,77,.4);}
  .ed-chip-custom-input{width:52px;background:transparent;border:none;outline:none;color:#c2904d;font-size:13px;font-weight:600;text-align:right;padding:0;}
  .ed-chip-custom-input::placeholder{color:#4a3e30;font-weight:400;}
  .ed-chip-custom-input::-webkit-outer-spin-button,.ed-chip-custom-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
  .ed-chip-custom-suffix{font-size:13px;color:#c2904d;}
  .ed-slug-row{display:flex;align-items:center;gap:0;}
  .ed-slug-prefix{background:#111009;border:1px solid #2a1f18;border-right:none;border-radius:10px 0 0 10px;padding:10px 12px;font-size:13px;color:#4a3e30;font-family:monospace;white-space:nowrap;}
  .ed-slug-input{border-radius:0 10px 10px 0!important;}
  .ed-slug-link{font-size:12px;color:#c2904d;text-decoration:none;}
  .ed-slug-link:hover{text-decoration:underline;}
  .ed-toggle-row{display:flex;align-items:center;gap:12px;}
  .ed-toggle{width:44px;height:24px;border-radius:99px;border:none;cursor:pointer;position:relative;flex-shrink:0;transition:background .2s;}
  .tog-on{background:#c2904d;}
  .tog-off{background:#2a1f18;}
  .tog-knob{position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff9e6;transition:left .2s;}
  .tog-on .tog-knob{left:23px;}
  .tog-off .tog-knob{left:3px;}
  .ed-toggle-label{font-size:13px;color:#7a6e5e;}
  .ed-links{display:flex;flex-direction:column;gap:8px;}
  .ed-link-card{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.02);border:1px solid #2a1f18;border-radius:12px;padding:14px 16px;text-decoration:none;transition:all .15s;cursor:pointer;}
  .ed-link-card:hover{border-color:rgba(194,144,77,.3);background:rgba(194,144,77,.04);}
  .ed-link-icon{font-size:18px;color:#4a3e30;width:24px;text-align:center;}
  .ed-link-titulo{font-size:13px;font-weight:600;color:#fff9e6;margin-bottom:2px;}
  .ed-link-desc{font-size:11px;color:#4a3e30;}
  .ed-link-arrow{margin-left:auto;color:#4a3e30;font-size:14px;}
  .ed-link-card:hover .ed-link-arrow{color:#c2904d;}
  @media(max-width:768px){
    .ed-root{padding:20px;}
    .ed-body{grid-template-columns:1fr;}
    .ed-col-foto{order:1;}
  }
`

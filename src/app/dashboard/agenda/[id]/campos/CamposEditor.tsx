"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Campo = { id?: string; nome: string; tipo: string; obrigatorio: boolean; ordem: number; fixo?: boolean }
type Pessoa = { id: string; nome: string; role: string }

const TIPOS = ['text', 'email', 'tel', 'textarea', 'select', 'number', 'date']
const TIPOS_LABEL: Record<string, string> = {
  text: 'Texto curto', email: 'E-mail', tel: 'Telefone',
  textarea: 'Texto longo', select: 'Seleção', number: 'Número', date: 'Data',
}

function uid() { return Math.random().toString(36).slice(2) }

export default function CamposEditor({ pessoa, camposIniciais }: { pessoa: Pessoa; camposIniciais: Campo[] }) {
  const router = useRouter()
  const [campos, setCampos] = useState<Array<Campo & { _key: string }>>(() =>
    camposIniciais.map(c => ({ ...c, _key: uid() }))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [erro, setErro] = useState('')

  const extras = campos.filter(c => !c.fixo)
  const temEmailObrig = campos.some(c => c.tipo === 'email' && c.obrigatorio)
  const temWhatsObrig = campos.some(c => c.tipo === 'tel' && c.obrigatorio)

  function addCampo() {
    setCampos(prev => [...prev, { _key: uid(), nome: '', tipo: 'text', obrigatorio: false, ordem: prev.length, fixo: false }])
  }

  function removeCampo(key: string) {
    setCampos(prev => prev.filter(c => c._key !== key).map((c, i) => ({ ...c, ordem: i })))
  }

  function updateCampo(key: string, partial: Partial<Campo>) {
    setCampos(prev => prev.map(c => c._key === key ? { ...c, ...partial } : c))
  }

  function moverCima(key: string) {
    setCampos(prev => {
      const idx = prev.findIndex(c => c._key === key)
      if (idx <= 0) return prev
      const arr = [...prev]
      ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
      return arr.map((c, i) => ({ ...c, ordem: i }))
    })
  }

  function moverBaixo(key: string) {
    setCampos(prev => {
      const idx = prev.findIndex(c => c._key === key)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const arr = [...prev]
      ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
      return arr.map((c, i) => ({ ...c, ordem: i }))
    })
  }

  async function salvar() {
    setSaving(true); setErro('')
    const res = await fetch('/api/admin/agenda/campos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pessoaId: pessoa.id,
        campos: campos.map(({ _key, id: _id, ...rest }) => rest),
      }),
    })
    if (!res.ok) { setErro('Erro ao salvar'); setSaving(false); return }
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  return (
    <>
      <style>{css}</style>
      <div className="cm-root">
        <div className="cm-header">
          <div className="cm-header-left">
            <button className="cm-back" onClick={() => router.push(`/dashboard/agenda/${pessoa.id}`)}>← Voltar</button>
            <div>
              <h1 className="cm-titulo">Campos do Formulário — {pessoa.nome}</h1>
              {pessoa.role && <p className="cm-sub">{pessoa.role}</p>}
            </div>
          </div>
          <button className="cm-salvar-btn" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar'}
          </button>
        </div>

        {erro && <div className="cm-erro">{erro}</div>}

        {/* Alertas */}
        {!temEmailObrig && (
          <div className="cm-alerta">
            ⚠ O campo de <strong>E-mail</strong> não está obrigatório. O lead pode não receber confirmações por e-mail.
          </div>
        )}
        {!temWhatsObrig && (
          <div className="cm-alerta">
            ⚠ O campo de <strong>WhatsApp</strong> não está obrigatório. O lead pode não receber a confirmação via WhatsApp.
          </div>
        )}

        <div className="cm-info">
          Todos os campos aparecem no formulário público. Os campos marcados com 🔒 são padrão do sistema mas você pode personalizar o nome e a obrigatoriedade.
        </div>

        <div className="cm-campos-list">
          {campos.map((c, idx) => {
            const isUltimo = idx === campos.length - 1
            return (
              <div key={c._key} className={`cm-campo-row ${c.fixo ? 'cm-campo-fixo' : ''}`}>
                <div className="cm-ordem-btns">
                  <button className="cm-ord-btn" onClick={() => moverCima(c._key)} disabled={idx === 0} type="button">▲</button>
                  <button className="cm-ord-btn" onClick={() => moverBaixo(c._key)} disabled={isUltimo} type="button">▼</button>
                </div>

                {c.fixo && <span className="cm-lock-icon">🔒</span>}

                <input
                  className="cm-nome-input"
                  placeholder="Nome do campo (ex: Cidade, Objetivo…)"
                  value={c.nome}
                  onChange={e => updateCampo(c._key, { nome: e.target.value })}
                />

                <select
                  className="cm-tipo-select"
                  value={c.tipo}
                  onChange={e => updateCampo(c._key, { tipo: e.target.value })}
                  disabled={c.fixo}
                >
                  {TIPOS.map(t => (
                    <option key={t} value={t}>{TIPOS_LABEL[t]}</option>
                  ))}
                </select>

                <label className="cm-obrig-label">
                  <input
                    type="checkbox"
                    checked={c.obrigatorio}
                    onChange={e => updateCampo(c._key, { obrigatorio: e.target.checked })}
                  />
                  <span>Obrigatório</span>
                </label>

                {!c.fixo && (
                  <button className="cm-del-btn" onClick={() => removeCampo(c._key)} type="button" title="Remover">🗑</button>
                )}
              </div>
            )
          })}
        </div>

        <button className="cm-add-btn" onClick={addCampo} type="button">+ Adicionar campo personalizado</button>

        <div className="cm-footer-mobile">
          <button className="cm-salvar-btn" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar campos'}
          </button>
        </div>
      </div>
    </>
  )
}

const css = `
  .cm-root{padding:28px 32px;max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:16px;}
  .cm-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .cm-header-left{display:flex;align-items:flex-start;gap:16px;}
  .cm-back{background:none;border:none;color:#7a6e5e;font-size:14px;cursor:pointer;font-family:inherit;padding:0;transition:color .15s;white-space:nowrap;margin-top:4px;}
  .cm-back:hover{color:#c2904d;}
  .cm-titulo{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#fff9e6;}
  .cm-sub{font-size:12px;color:#4a3e30;margin-top:2px;}
  .cm-salvar-btn{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;border:none;border-radius:10px;padding:11px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;white-space:nowrap;}
  .cm-salvar-btn:hover:not(:disabled){filter:brightness(1.08);}
  .cm-salvar-btn:disabled{opacity:.6;cursor:not-allowed;}
  .cm-erro{background:rgba(224,88,64,.1);border:1px solid rgba(224,88,64,.3);border-radius:10px;padding:12px 16px;font-size:14px;color:#e05840;}
  .cm-alerta{background:rgba(194,144,77,.08);border:1px solid rgba(194,144,77,.25);border-radius:10px;padding:11px 16px;font-size:13px;color:#c2904d;}
  .cm-info{background:#1a1410;border:1px solid #2a1f18;border-radius:12px;padding:12px 16px;font-size:13px;color:#7a6e5e;line-height:1.5;}
  .cm-campos-list{display:flex;flex-direction:column;gap:8px;}
  .cm-campo-row{background:#1a1410;border:1px solid #2a1f18;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .cm-campo-fixo{border-color:rgba(194,144,77,.15);}
  .cm-lock-icon{font-size:13px;flex-shrink:0;}
  .cm-ordem-btns{display:flex;flex-direction:column;gap:2px;flex-shrink:0;}
  .cm-ord-btn{background:none;border:1px solid #2a1f18;border-radius:4px;width:22px;height:18px;cursor:pointer;font-size:9px;color:#4a3e30;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .cm-ord-btn:hover:not(:disabled){border-color:rgba(194,144,77,.3);color:#c2904d;}
  .cm-ord-btn:disabled{opacity:.3;cursor:not-allowed;}
  .cm-nome-input{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:8px 12px;font-size:14px;color:#fff9e6;font-family:inherit;outline:none;transition:border-color .2s;flex:1;min-width:140px;}
  .cm-nome-input:focus{border-color:rgba(194,144,77,.4);}
  .cm-tipo-select{background:#111009;border:1px solid #2a1f18;border-radius:8px;padding:8px 10px;font-size:13px;color:#fff9e6;font-family:inherit;outline:none;cursor:pointer;transition:border-color .2s;}
  .cm-tipo-select:disabled{opacity:.5;cursor:not-allowed;}
  .cm-tipo-select:focus{border-color:rgba(194,144,77,.4);}
  .cm-obrig-label{display:flex;align-items:center;gap:6px;font-size:13px;color:#7a6e5e;cursor:pointer;white-space:nowrap;}
  .cm-obrig-label input{accent-color:#c2904d;width:14px;height:14px;}
  .cm-del-btn{background:none;border:none;cursor:pointer;font-size:15px;opacity:.5;transition:opacity .15s;padding:4px;flex-shrink:0;margin-left:auto;}
  .cm-del-btn:hover{opacity:1;}
  .cm-add-btn{background:none;border:1px dashed rgba(194,144,77,.3);border-radius:10px;padding:11px;font-size:13px;color:#c2904d;cursor:pointer;font-family:inherit;transition:all .15s;width:100%;}
  .cm-add-btn:hover{background:rgba(194,144,77,.06);}
  .cm-footer-mobile{display:none;}
  @media(max-width:600px){
    .cm-root{padding:16px;}
    .cm-header{flex-direction:column;}
    .cm-campo-row{flex-direction:column;align-items:flex-start;}
    .cm-nome-input{width:100%;}
    .cm-footer-mobile{display:flex;justify-content:center;padding-top:8px;}
    .cm-footer-mobile .cm-salvar-btn{width:100%;}
  }
`

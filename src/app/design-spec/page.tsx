'use client'

import { useState, useEffect, useRef } from 'react'
import { verificarSenha } from './actions'

const MAX_TENTATIVAS = 3
const BLOQUEIO_KEY = 'ds-bloqueado-ate'
const TENTATIVAS_KEY = 'ds-tentativas'

export default function DesignSpecPage() {
  const [autenticado, setAutenticado] = useState(false)
  const [checando, setChecando] = useState(true)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [bloqueado, setBloqueado] = useState(false)
  const [tentativas, setTentativas] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Verifica bloqueio
    const bloqAte = localStorage.getItem(BLOQUEIO_KEY)
    if (bloqAte && Date.now() < parseInt(bloqAte)) {
      setBloqueado(true)
    }
    const t = parseInt(localStorage.getItem(TENTATIVAS_KEY) || '0')
    setTentativas(t)

    // Verifica se já tem cookie de auth (faz uma request de teste)
    fetch('/api/design-spec-content', { method: 'HEAD' })
      .then(r => { if (r.ok) setAutenticado(true) })
      .catch(() => {})
      .finally(() => setChecando(false))
  }, [])

  useEffect(() => {
    if (!checando && !autenticado && !bloqueado) {
      inputRef.current?.focus()
    }
  }, [checando, autenticado, bloqueado])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (bloqueado || enviando) return
    setEnviando(true)
    setErro('')

    const { ok } = await verificarSenha(senha)
    setEnviando(false)

    if (ok) {
      localStorage.removeItem(BLOQUEIO_KEY)
      localStorage.removeItem(TENTATIVAS_KEY)
      setAutenticado(true)
    } else {
      const novas = tentativas + 1
      setTentativas(novas)
      localStorage.setItem(TENTATIVAS_KEY, String(novas))

      if (novas >= MAX_TENTATIVAS) {
        const ate = Date.now() + 30 * 60 * 1000
        localStorage.setItem(BLOQUEIO_KEY, String(ate))
        setBloqueado(true)
        setErro('Acesso bloqueado por 30 minutos após múltiplas tentativas incorretas.')
      } else {
        setErro(`Senha incorreta. ${MAX_TENTATIVAS - novas} tentativa(s) restante(s).`)
      }
      setSenha('')
      inputRef.current?.focus()
    }
  }

  if (checando) return null

  if (autenticado) {
    return (
      <iframe
        src="/api/design-spec-content"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }}
        title="Maestria Social — Design Spec"
      />
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e0f09',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '24px',
    }}>
      <div style={{
        background: '#1a1410',
        border: '1px solid #2a1f18',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #c2904d, #fee69d)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '20px',
          }}>🔒</div>
          <h1 style={{ color: '#fff9e6', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
            Design Spec
          </h1>
          <p style={{ color: '#7a6e5e', fontSize: '14px' }}>
            Maestria Social — Acesso restrito
          </p>
        </div>

        {bloqueado ? (
          <div style={{
            background: '#2a1010',
            border: '1px solid #e05840',
            borderRadius: '10px',
            padding: '16px',
            color: '#e07070',
            fontSize: '14px',
            lineHeight: 1.5,
          }}>
            🚫 Acesso bloqueado por 30 minutos devido a múltiplas tentativas incorretas.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <label style={{ color: '#7a6e5e', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                Senha de acesso
              </label>
              <input
                ref={inputRef}
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Digite a senha"
                required
                style={{
                  width: '100%',
                  background: '#22180f',
                  border: `1px solid ${erro ? '#e05840' : '#2a1f18'}`,
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: '#fff9e6',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            {erro && (
              <div style={{
                background: '#2a1010',
                border: '1px solid #e05840',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#e07070',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'left',
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={enviando || !senha}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #c2904d, #d4a055)',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                color: '#0e0f09',
                fontWeight: 700,
                fontSize: '14px',
                cursor: enviando || !senha ? 'not-allowed' : 'pointer',
                opacity: enviando || !senha ? 0.6 : 1,
              }}
            >
              {enviando ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PaginasGate() {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!senha.trim()) return
    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/admin/paginas/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      if (res.ok) {
        router.replace('/dashboard/paginas')
      } else {
        const d = await res.json()
        setErro(d.error || 'Senha incorreta')
        setSenha('')
      }
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0e0f09', fontFamily: 'Inter,system-ui,sans-serif',
    }}>
      <div style={{
        background: '#111009', border: '1px solid #2a1f18', borderRadius: 20,
        padding: '40px 36px', width: '100%', maxWidth: 380,
        boxShadow: '0 24px 80px rgba(0,0,0,.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h1 style={{ color: '#c2904d', fontSize: 20, fontWeight: 800, margin: '0 0 6px', letterSpacing: 1 }}>
            Área Restrita
          </h1>
          <p style={{ color: '#4a3e30', fontSize: 13, margin: 0 }}>
            Digite a senha para acessar o editor de páginas
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="Senha de acesso"
            autoFocus
            autoComplete="off"
            style={{
              width: '100%', padding: '13px 16px',
              background: '#1a170f', border: `1px solid ${erro ? '#7f1d1d' : '#2a1f18'}`,
              borderRadius: 10, color: '#fff9e6', fontSize: 15,
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              letterSpacing: 3,
            }}
          />
          {erro && (
            <p style={{ color: '#f87171', fontSize: 12, margin: '8px 0 0', textAlign: 'center' }}>
              ❌ {erro}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !senha.trim()}
            style={{
              width: '100%', marginTop: 16, padding: '13px',
              background: loading ? '#2a1f18' : '#c2904d',
              color: '#fff', border: 'none', borderRadius: 10,
              fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background .2s',
            }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

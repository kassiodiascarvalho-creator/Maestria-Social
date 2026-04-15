"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

const ETIQUETAS_FIXAS = [
  { value: "ia_atendendo", label: "IA atendendo", cor: "#5b9bd5" },
  { value: "humano_atendendo", label: "Humano atendendo", cor: "#7ac47a" },
]

function corEtiqueta(e: string): string {
  const fixa = ETIQUETAS_FIXAS.find(f => f.value === e)
  return fixa ? fixa.cor : "#c2904d"
}

function labelEtiqueta(e: string): string {
  const fixa = ETIQUETAS_FIXAS.find(f => f.value === e)
  return fixa ? fixa.label : e
}

export default function EtiquetaSelector({ leadId, etiquetaAtual }: { leadId: string; etiquetaAtual: string | null }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [aberto, setAberto] = useState(false)
  const [custom, setCustom] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const etiqueta = etiquetaAtual ?? "ia_atendendo"

  async function salvar(nova: string) {
    if (!nova.trim()) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/etiqueta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta: nova.trim() }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Erro ao salvar etiqueta")
        return
      }
      setAberto(false)
      setCustom("")
      startTransition(() => router.refresh())
    } catch {
      setErro("Erro de conexão")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="etq-wrap">
      <button
        className="etq-badge"
        style={{ color: corEtiqueta(etiqueta), borderColor: corEtiqueta(etiqueta) + "44" }}
        onClick={() => setAberto(a => !a)}
        title="Clique para alterar etiqueta"
        type="button"
      >
        {labelEtiqueta(etiqueta)}
        <span className="etq-caret">▾</span>
      </button>

      {aberto && (
        <div className="etq-dropdown">
          {ETIQUETAS_FIXAS.map(op => (
            <button
              key={op.value}
              className={`etq-option ${etiqueta === op.value ? "etq-option-ativa" : ""}`}
              style={{ color: op.cor }}
              onClick={() => salvar(op.value)}
              disabled={salvando}
              type="button"
            >
              {op.label}
            </button>
          ))}
          <div className="etq-custom-row">
            <input
              className="etq-custom-input"
              placeholder="Nome do colaborador…"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && custom.trim()) salvar(custom) }}
              disabled={salvando}
            />
            <button
              className="etq-custom-btn"
              onClick={() => salvar(custom)}
              disabled={salvando || !custom.trim()}
              type="button"
            >
              ✓
            </button>
          </div>
          {erro && <div className="etq-erro">{erro}</div>}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ExcluirLead({ leadId, nomeLocal }: { leadId: string; nomeLocal: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function excluir() {
    setExcluindo(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, { method: "DELETE" })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setErro(data.error ?? "Erro ao excluir")
        setExcluindo(false)
        return
      }
      router.push("/dashboard/leads")
    } catch {
      setErro("Erro de conexão")
      setExcluindo(false)
    }
  }

  if (confirmando) {
    return (
      <div className="excluir-confirm">
        <span className="excluir-aviso">Excluir <strong>{nomeLocal}</strong> e todo o histórico?</span>
        <button className="excluir-sim" onClick={excluir} disabled={excluindo} type="button">
          {excluindo ? "Excluindo…" : "Sim, excluir"}
        </button>
        <button className="excluir-nao" onClick={() => setConfirmando(false)} disabled={excluindo} type="button">
          Cancelar
        </button>
        {erro && <span className="excluir-erro">{erro}</span>}
      </div>
    )
  }

  return (
    <button className="excluir-btn" onClick={() => setConfirmando(true)} type="button" title="Excluir lead">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
      </svg>
      Excluir lead
    </button>
  )
}

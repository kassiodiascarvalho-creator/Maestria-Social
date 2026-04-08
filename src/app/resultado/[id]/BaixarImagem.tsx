"use client";

import { useState } from "react";

export default function BaixarImagem({ nome, leadId }: { nome: string; leadId: string }) {
  const [baixando, setBaixando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function salvar() {
    if (baixando) return;
    setBaixando(true);
    try {
      // Abre a imagem OG em nova aba — usuário usa "Salvar imagem como"
      // (funciona em 100% dos browsers, desktop e mobile)
      window.open(`/api/og/resultado/${leadId}`, "_blank");
    } catch (err) {
      console.error("[BaixarImagem]", err);
    } finally {
      setBaixando(false);
    }
  }

  async function compartilhar() {
    if (compartilhando) return;
    setCompartilhando(true);
    try {
      const urlResultado = `https://maestriasocial.com/resultado/${leadId}`;
      const texto = `Fiz o Diagnóstico de Quociente Social. Veja meu resultado e faça o seu:`;
      if (navigator.share) {
        await navigator.share({ title: "Meu Quociente Social — Maestria Social", text: texto, url: urlResultado });
        return;
      }
      await navigator.clipboard.writeText(`${texto} ${urlResultado}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // cancelado
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
      <button onClick={salvar} disabled={baixando} className="r-download" type="button">
        {baixando ? "Gerando..." : "↓ Baixar imagem"}
      </button>
      <button onClick={compartilhar} disabled={compartilhando} className="r-download" type="button">
        {compartilhando ? "..." : copiado ? "✓ Link copiado!" : "↗ Compartilhar"}
      </button>
    </div>
  );
}

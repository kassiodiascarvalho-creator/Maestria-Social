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
      const card = document.getElementById("resultado-card");
      if (!card) throw new Error("Card não encontrado");

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#1a1410",
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `maestria-social-${nome}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/jpeg", 0.95);
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
        await navigator.share({
          title: "Meu Quociente Social — Maestria Social",
          text: texto,
          url: urlResultado,
        });
        return;
      }

      // Fallback: copiar link
      await navigator.clipboard.writeText(`${texto} ${urlResultado}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // usuário cancelou
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

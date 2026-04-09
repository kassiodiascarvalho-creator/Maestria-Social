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
      if (!card) return;

      // Oculta elementos que não devem aparecer na imagem
      const nocapture = card.querySelector("[data-nocapture]") as HTMLElement | null;
      if (nocapture) nocapture.style.display = "none";

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#1a1410",
        logging: false,
      });

      if (nocapture) nocapture.style.display = "";

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `quociente-social-${nome}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
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
      const texto = `Acabei de fazer o Diagnóstico de Quociente Social e quero que você faça o seu também! Acesse o link e descubra seu nível:`;

      if (navigator.share) {
        await navigator.share({
          title: "Meu Quociente Social — Maestria Social",
          text: texto,
          url: urlResultado,
        });
        return;
      }

      await navigator.clipboard.writeText(`${texto}\n${urlResultado}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // cancelado pelo usuário
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 20, paddingTop: 16, borderTop: "1px solid #2a1f18" }}>
      <button onClick={salvar} disabled={baixando} className="r-download" type="button">
        {baixando ? "Gerando..." : "↓ Baixar imagem"}
      </button>
      <button onClick={compartilhar} disabled={compartilhando} className="r-download" type="button">
        {compartilhando ? "..." : copiado ? "✓ Link copiado!" : "↗ Compartilhar resultado"}
      </button>
    </div>
  );
}

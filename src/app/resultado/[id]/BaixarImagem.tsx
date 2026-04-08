"use client";

import { useState } from "react";

export default function BaixarImagem({ url, nome }: { url: string; nome: string }) {
  const [baixando, setBaixando] = useState(false);

  async function salvar() {
    if (baixando) return;
    setBaixando(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `maestria-social-${nome}.png`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <button onClick={salvar} disabled={baixando} className="r-download" type="button">
      {baixando ? "Baixando..." : "↓ Baixar imagem"}
    </button>
  );
}

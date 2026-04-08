"use client";

import { useState } from "react";

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.blob();
}

export default function BaixarImagem({ url, nome }: { url: string; nome: string }) {
  const [baixando, setBaixando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);

  async function salvar() {
    if (baixando) return;
    setBaixando(true);
    try {
      const jpg = await fetchBlob(url);
      const objectUrl = URL.createObjectURL(jpg);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `maestria-social-${nome}.jpg`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setBaixando(false);
    }
  }

  async function compartilhar() {
    if (compartilhando) return;
    setCompartilhando(true);
    try {
      const jpg = await fetchBlob(url);
      const file = new File([jpg], `maestria-social-${nome}.jpg`, { type: "image/jpeg" });
      const texto = `Fiz o Diagnóstico de Quociente Social. Veja meu resultado e faça o seu:`;
      const urlSite = "https://maestriasocial.com";

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Meu Quociente Social", text: `${texto} ${urlSite}` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Meu Quociente Social", text: texto, url: urlSite });
        return;
      }
      await navigator.clipboard.writeText(`${texto} ${urlSite}`);
    } catch {
      // usuário cancelou
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
      <button onClick={salvar} disabled={baixando} className="r-download" type="button">
        {baixando ? "Baixando..." : "↓ Baixar imagem"}
      </button>
      <button onClick={compartilhar} disabled={compartilhando} className="r-download" type="button">
        {compartilhando ? "Gerando..." : "↗ Compartilhar"}
      </button>
    </div>
  );
}

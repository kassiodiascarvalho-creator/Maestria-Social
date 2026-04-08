"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type QuizResumo = {
  total?: number;
  percentual?: number;
  nivel?: string;
  pilarFraco?: string;
};

async function fetchImagemJpg(url: string): Promise<Blob> {
  const res = await fetch(url);
  const blob = await res.blob();
  // Converte PNG → JPEG via Canvas
  const imgUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.src = imgUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
  });
  URL.revokeObjectURL(imgUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 1200, 630);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Falha ao gerar JPG")), "image/jpeg", 0.95);
  });
}

export default function ObrigadoPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [linkWhatsApp, setLinkWhatsApp] = useState("");
  const [resumo, setResumo] = useState<QuizResumo>({});
  const [leadId, setLeadId] = useState<string | null>(null);
  const [compartilhando, setCompartilhando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function load() {
      const leadId = sessionStorage.getItem("lead_id");
      setLeadId(leadId);
      const quizRaw = sessionStorage.getItem("quiz_result");
      if (quizRaw) {
        try { setResumo(JSON.parse(quizRaw) as QuizResumo); } catch { setResumo({}); }
      }

      if (!leadId) {
        setErro("Lead não identificado. Refaça o diagnóstico.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/quiz/whatsapp-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Não foi possível montar o link do WhatsApp.");
        setLinkWhatsApp(data.link);
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : "Erro ao gerar link.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const titulo = useMemo(() => resumo.pilarFraco || "influência", [resumo.pilarFraco]);
  const imagemUrl = leadId ? `/api/og/resultado/${leadId}` : "";

  async function salvarImagem() {
    if (!imagemUrl || baixando) return;
    setBaixando(true);
    try {
      const jpg = await fetchImagemJpg(imagemUrl);
      const url = URL.createObjectURL(jpg);
      const a = document.createElement("a");
      a.href = url;
      a.download = "maestria-social-resultado.jpg";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  }

  async function compartilhar() {
    if (!imagemUrl || compartilhando) return;
    setCompartilhando(true);
    try {
      const jpg = await fetchImagemJpg(imagemUrl);
      const file = new File([jpg], "maestria-social-resultado.jpg", { type: "image/jpeg" });
      const texto = `Fiz o Diagnóstico de Quociente Social e tirei ${resumo.total ?? 0}/250 — nível ${resumo.nivel ?? ""}. Faça o seu:`;
      const urlSite = "https://maestriasocial.com";

      // Compartilha com imagem (abre Stories, WhatsApp, etc. no mobile)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Meu Quociente Social", text: `${texto} ${urlSite}` });
        return;
      }

      // Fallback: tenta share só com texto/URL
      if (navigator.share) {
        await navigator.share({ title: "Meu Quociente Social", text: texto, url: urlSite });
        return;
      }

      // Fallback desktop: copia link
      await navigator.clipboard.writeText(`${texto} ${urlSite}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // usuário cancelou ou erro — ignora
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <>
      <style>{css}</style>
      <main className="obg-wrap">
        <div className="obg-card">
          <div className="obg-tag">Resultado Finalizado</div>
          <h1 className="obg-title">Seu próximo passo já está claro.</h1>
          <p className="obg-desc">
            Seu diagnóstico foi registrado com sucesso.
            {resumo.total ? ` Resultado: ${resumo.total}/250 (${resumo.percentual ?? 0}%), nível ${resumo.nivel}.` : ""}
            {` Agora vamos evoluir seu pilar de ${titulo}.`}
          </p>

          {loading && <p className="obg-muted">Preparando sua mensagem personalizada...</p>}
          {!loading && erro && <p className="obg-error">{erro}</p>}

          {!loading && !erro && (
            <a className="obg-btn" href={linkWhatsApp} target="_blank" rel="noopener noreferrer">
              Quero desenvolver minha {titulo} no WhatsApp →
            </a>
          )}

          {!loading && leadId && (
            <div className="obg-actions">
              <button className="obg-action" onClick={salvarImagem} disabled={baixando} type="button">
                {baixando ? "Baixando..." : "↓ Salvar resultado"}
              </button>
              <button className="obg-action" onClick={compartilhar} disabled={compartilhando} type="button">
                {compartilhando ? "Gerando..." : copiado ? "✓ Link copiado!" : "↗ Compartilhar imagem"}
              </button>
              <a className="obg-action" href={`/resultado/${leadId}`} target="_blank" rel="noopener noreferrer">
                ◉ Ver página pública
              </a>
            </div>
          )}

          <div className="obg-links">
            <Link href="/quiz">Refazer diagnóstico</Link>
            <Link href="/">Voltar para início</Link>
          </div>
        </div>
      </main>
    </>
  );
}

const css = `
  .obg-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0e0f09;}
  .obg-card{width:100%;max-width:640px;background:#1a1410;border:1px solid #2a1f18;border-radius:18px;padding:38px 30px;}
  .obg-tag{font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c2904d;margin-bottom:14px;}
  .obg-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:42px;line-height:1.05;color:#fff9e6;margin-bottom:14px;}
  .obg-desc{font-size:15px;line-height:1.7;color:#7a6e5e;margin-bottom:20px;}
  .obg-muted{font-size:14px;color:#7a6e5e;}
  .obg-error{font-size:14px;color:#e05840;}
  .obg-btn{display:inline-block;margin-top:8px;background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;}
  .obg-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;}
  .obg-action{flex:1;min-width:140px;background:rgba(194,144,77,.06);border:1px solid rgba(194,144,77,.2);color:#c2904d;text-decoration:none;font-size:13px;font-weight:600;padding:11px 14px;border-radius:10px;text-align:center;cursor:pointer;font-family:inherit;transition:background .15s,border-color .15s;}
  .obg-action:hover{background:rgba(194,144,77,.12);border-color:rgba(194,144,77,.4);}
  .obg-action:disabled{opacity:.5;cursor:default;}
  .obg-links{display:flex;gap:16px;margin-top:20px;flex-wrap:wrap;}
  .obg-links a{font-size:13px;color:#7a6e5e;text-decoration:none;}
  .obg-links a:hover{color:#c2904d;}
`;

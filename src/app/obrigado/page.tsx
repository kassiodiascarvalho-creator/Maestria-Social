"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type QuizResumo = {
  total?: number;
  percentual?: number;
  nivel?: string;
  pilarFraco?: string;
};

export default function ObrigadoPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [linkWhatsApp, setLinkWhatsApp] = useState("");
  const [resumo, setResumo] = useState<QuizResumo>({});

  useEffect(() => {
    async function load() {
      const leadId = sessionStorage.getItem("lead_id");
      const quizRaw = sessionStorage.getItem("quiz_result");
      if (quizRaw) {
        try {
          setResumo(JSON.parse(quizRaw) as QuizResumo);
        } catch {
          setResumo({});
        }
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
  .obg-links{display:flex;gap:16px;margin-top:20px;flex-wrap:wrap;}
  .obg-links a{font-size:13px;color:#7a6e5e;text-decoration:none;}
  .obg-links a:hover{color:#c2904d;}
`;

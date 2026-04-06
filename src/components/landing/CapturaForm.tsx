"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import IMask from "imask";

export default function CapturaForm() {
  const router = useRouter();
  const whatsappRef = useRef<HTMLInputElement>(null);
  const maskRef = useRef<InstanceType<typeof IMask.InputMask> | null>(null);

  const [fields, setFields] = useState({ nome: "", email: "", whatsapp: "", instagram: "", profissao: "", renda_mensal: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (whatsappRef.current) {
      maskRef.current = IMask(whatsappRef.current, {
        mask: "(00) 00000-0000",
      });
      maskRef.current.on("accept", () => {
        setFields((prev) => ({ ...prev, whatsapp: maskRef.current!.value }));
      });
    }
    return () => maskRef.current?.destroy();
  }, []);

  function validate() {
    const e: Record<string, string> = {};
    if (!fields.nome.trim()) e.nome = "Informe seu nome completo";
    if (!fields.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      e.email = "Informe um e-mail válido";
    const digits = fields.whatsapp.replace(/\D/g, "");
    if (digits.length < 10) e.whatsapp = "Informe um WhatsApp válido com DDD";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError("");
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: fields.nome,
          email: fields.email,
          whatsapp: fields.whatsapp,
          instagram: fields.instagram || null,
          profissao: fields.profissao || null,
          renda_mensal: fields.renda_mensal || null,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.id) throw new Error(data.error || "Erro ao salvar");
      // Salva lead_id no sessionStorage para o quiz usar
      sessionStorage.setItem("lead_id", data.id);
      sessionStorage.setItem("lead_nome", fields.nome.trim());
      sessionStorage.setItem("lead_whatsapp", fields.whatsapp.replace(/\D/g, ""));
      router.push("/quiz");
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ width: "100%", maxWidth: 420 }}>
      <div className="ms-field-group">
        {/* Nome */}
        <div className="ms-field">
          <label className="ms-label">Nome completo</label>
          <input
            className={`ms-input${errors.nome ? " ms-input--error" : ""}`}
            type="text"
            placeholder="Seu nome"
            autoComplete="name"
            value={fields.nome}
            onChange={(e) => setFields((p) => ({ ...p, nome: e.target.value }))}
          />
          {errors.nome && <span className="ms-error">{errors.nome}</span>}
        </div>

        {/* Email */}
        <div className="ms-field">
          <label className="ms-label">E-mail</label>
          <input
            className={`ms-input${errors.email ? " ms-input--error" : ""}`}
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            value={fields.email}
            onChange={(e) => setFields((p) => ({ ...p, email: e.target.value }))}
          />
          {errors.email && <span className="ms-error">{errors.email}</span>}
        </div>

        {/* WhatsApp */}
        <div className="ms-field">
          <label className="ms-label">WhatsApp</label>
          <input
            ref={whatsappRef}
            className={`ms-input${errors.whatsapp ? " ms-input--error" : ""}`}
            type="tel"
            placeholder="(11) 99999-9999"
            autoComplete="tel"
          />
          {errors.whatsapp && <span className="ms-error">{errors.whatsapp}</span>}
        </div>

        {/* Instagram */}
        <div className="ms-field">
          <label className="ms-label">Instagram</label>
          <input
            className="ms-input"
            type="text"
            placeholder="@seuperfil"
            value={fields.instagram}
            onChange={(e) => setFields((p) => ({ ...p, instagram: e.target.value }))}
          />
        </div>

        {/* Profissão */}
        <div className="ms-field">
          <label className="ms-label">Profissão</label>
          <input
            className="ms-input"
            type="text"
            placeholder="Ex: Empresário, Médico, Coach…"
            value={fields.profissao}
            onChange={(e) => setFields((p) => ({ ...p, profissao: e.target.value }))}
          />
        </div>

        {/* Renda Mensal */}
        <div className="ms-field">
          <label className="ms-label">Renda Mensal</label>
          <select
            className="ms-input ms-select"
            value={fields.renda_mensal}
            onChange={(e) => setFields((p) => ({ ...p, renda_mensal: e.target.value }))}
          >
            <option value="">Selecione sua faixa de renda</option>
            <option value="Até R$ 3.000">Até R$ 3.000</option>
            <option value="R$ 3.000 – R$ 7.000">R$ 3.000 – R$ 7.000</option>
            <option value="R$ 7.000 – R$ 15.000">R$ 7.000 – R$ 15.000</option>
            <option value="R$ 15.000 – R$ 30.000">R$ 15.000 – R$ 30.000</option>
            <option value="Acima de R$ 30.000">Acima de R$ 30.000</option>
          </select>
        </div>
      </div>

      {apiError && <p className="ms-api-error">{apiError}</p>}

      <button type="submit" className="ms-cta-btn" disabled={loading}>
        {loading ? (
          <span className="ms-spinner" />
        ) : (
          <>Descobrir meu Quociente Social <span className="ms-arrow">→</span></>
        )}
      </button>

      <p className="ms-privacy">
        Seus dados são protegidos e não serão compartilhados.
      </p>
    </form>
  );
}

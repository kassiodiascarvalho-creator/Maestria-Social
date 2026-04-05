"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-mail ou senha incorretos");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <style>{css}</style>
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">
            <span className="login-diamond">◆</span>
            Maestria Social
          </div>
          <h1 className="login-title">Acesso à Plataforma</h1>
          <p className="login-sub">Entre com suas credenciais para continuar</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">E-mail</label>
              <input
                className="login-input"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Senha</label>
              <input
                className="login-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? <span className="login-spinner" /> : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const css = `
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#0e0f09;color:#fff9e6;font-family:'Inter',system-ui,sans-serif;min-height:100vh;}
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0e0f09;}
  .login-card{width:100%;max-width:400px;background:#1a1410;border:1px solid #2a1f18;border-radius:20px;padding:44px 40px;}
  .login-logo{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#c2904d;margin-bottom:32px;}
  .login-diamond{font-size:8px;}
  .login-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;margin-bottom:8px;}
  .login-sub{font-size:14px;color:#7a6e5e;margin-bottom:32px;font-weight:300;}
  .login-form{display:flex;flex-direction:column;gap:18px;}
  .login-field{display:flex;flex-direction:column;gap:6px;}
  .login-label{font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#7a6e5e;}
  .login-input{background:rgba(255,255,255,.04);border:1px solid #2a1f18;border-radius:12px;padding:13px 16px;font-size:15px;color:#fff9e6;font-family:inherit;outline:none;transition:border-color .2s;}
  .login-input::placeholder{color:#3d3328;}
  .login-input:focus{border-color:rgba(194,144,77,.5);background:rgba(194,144,77,.04);}
  .login-error{font-size:13px;color:#e05840;text-align:center;}
  .login-btn{background:linear-gradient(135deg,#c2904d,#d4a055);color:#0e0f09;font-family:inherit;font-size:15px;font-weight:700;padding:14px;border:none;border-radius:12px;cursor:pointer;transition:filter .2s,transform .2s;margin-top:4px;}
  .login-btn:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px);}
  .login-btn:disabled{opacity:.6;cursor:not-allowed;}
  .login-spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(14,15,9,.3);border-top-color:#0e0f09;border-radius:50%;animation:spin .7s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}
`;

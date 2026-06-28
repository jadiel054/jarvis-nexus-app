"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage({ text: "Email ou senha incorretos.", type: "error" });
    } else {
      router.push("/jarvis");
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage({ text: error.message, type: "error" });
    } else {
      setMessage({ text: "Conta criada! Verifique seu email para confirmar.", type: "success" });
    }
    setLoading(false);
  };

  const handleReset = async () => {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) {
      setMessage({ text: error.message, type: "error" });
    } else {
      setMessage({ text: "Email de recuperação enviado!", type: "success" });
    }
    setLoading(false);
  };

  const handleSubmit = () => {
    if (mode === "login") handleLogin();
    else if (mode === "signup") handleSignup();
    else handleReset();
  };

  return (
    <>
      <style>{`
        @keyframes neon-rotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .login-wrapper {
          min-height: 100vh;
          background: #0a0a0f;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }
        .login-title {
          color: #fff;
          font-size: clamp(1.2rem, 4vw, 1.8rem);
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 2.5rem;
          opacity: 0.9;
        }
        .login-title span {
          background: linear-gradient(90deg, #35eaff, #ff0a6c);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .box-outer {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          width: min(340px, 90vw);
          cursor: pointer;
        }
        .box-outer.collapsed { height: 64px; }
        .box-outer.expanded  { height: auto; min-height: 320px; cursor: default; }
        .box-outer::before {
          content: "";
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg 36deg,
            #35eaff 36deg 48deg,
            transparent 48deg 126deg,
            #ff0a6c 126deg 138deg,
            transparent 138deg 216deg,
            #35eaff 216deg 228deg,
            transparent 228deg 306deg,
            #ff0a6c 306deg 318deg,
            transparent 318deg 360deg
          );
          filter: blur(1px) drop-shadow(0 0 12px #35eaff);
          animation: neon-rotate 5s linear infinite;
          z-index: 0;
        }
        .box-inner {
          position: relative;
          z-index: 1;
          background: #111118;
          border-radius: 14px;
          margin: 2px;
          padding: 1.2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0;
          transition: padding 0.4s ease;
        }
        .box-outer.expanded .box-inner { padding: 1.5rem; gap: 0.75rem; }
        .login-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          height: 40px;
        }
        .login-header-text {
          color: #fff;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        .login-icon { font-size: 1rem; }
        .form-section {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .box-outer.expanded .form-section { max-height: 400px; opacity: 1; }
        .input-field {
          background: #1a1a24;
          border: 1px solid #2a2a3a;
          border-radius: 8px;
          padding: 0.7rem 1rem;
          color: #e0e0e0;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
          box-sizing: border-box;
        }
        .input-field:focus { border-color: #35eaff; }
        .input-field::placeholder { color: #555; }
        .btn-primary {
          background: linear-gradient(135deg, #35eaff, #0099bb);
          border: none;
          border-radius: 8px;
          padding: 0.75rem;
          color: #000;
          font-weight: 700;
          font-size: 0.9rem;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
          margin-top: 0.25rem;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .links-row {
          display: flex;
          justify-content: space-between;
          margin-top: 0.25rem;
        }
        .link-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 0.78rem;
          cursor: pointer;
          padding: 0;
          transition: color 0.2s;
        }
        .link-btn:hover { color: #35eaff; }
        .link-btn.accent { color: #ff0a6c; }
        .link-btn.accent:hover { color: #ff5a8c; }
        .msg {
          font-size: 0.8rem;
          text-align: center;
          padding: 0.4rem;
          border-radius: 6px;
        }
        .msg.error   { color: #ff6b6b; background: #2a1010; }
        .msg.success { color: #6bffb8; background: #102a1a; }
        .mode-title {
          color: #aaa;
          font-size: 0.78rem;
          text-align: center;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }
      `}</style>

      <div className="login-wrapper">
        <p className="login-title">
          <span>J.A.R.V.I.S.</span> — Sistema de Agentes
        </p>

        <div
          className={`box-outer ${expanded ? "expanded" : "collapsed"}`}
          onClick={() => !expanded && setExpanded(true)}
        >
          <div className="box-inner">
            <div className="login-header">
              <span className="login-icon">⚡</span>
              <span className="login-header-text">
                {mode === "login" ? "Login" : mode === "signup" ? "Criar Conta" : "Recuperar"}
              </span>
              <span className="login-icon">🔒</span>
            </div>

            <div className="form-section">
              {mode !== "login" && (
                <p className="mode-title">
                  {mode === "signup" ? "Nova conta" : "Recuperar senha"}
                </p>
              )}

              <input
                className="input-field"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />

              {mode !== "reset" && (
                <input
                  className="input-field"
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              )}

              {message && (
                <p className={`msg ${message.type}`}>{message.text}</p>
              )}

              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? "Aguarde..."
                  : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                  ? "Criar conta"
                  : "Enviar email"}
              </button>

              <div className="links-row">
                <button
                  className="link-btn"
                  onClick={() => { setMode("reset"); setMessage(null); }}
                >
                  Esqueci a senha
                </button>
                <button
                  className="link-btn accent"
                  onClick={() => {
                    setMode(mode === "signup" ? "login" : "signup");
                    setMessage(null);
                  }}
                >
                  {mode === "signup" ? "Já tenho conta" : "Criar conta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

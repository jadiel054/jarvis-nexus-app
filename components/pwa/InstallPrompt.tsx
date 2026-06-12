"use client";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed as PWA — never show
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a short delay so the app has loaded
      setTimeout(() => setShow(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also show if user has visited 3+ times (engagement heuristic)
    try {
      const visits = parseInt(localStorage.getItem("jarvis_visits") || "0", 10) + 1;
      localStorage.setItem("jarvis_visits", String(visits));
      if (visits >= 3 && !deferredPrompt && !dismissed) {
        setTimeout(() => setShow(true), 3000);
      }
    } catch {}

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [deferredPrompt, dismissed]);

  const install = async () => {
    if (!deferredPrompt) {
      // Fallback: show manual instructions
      setShow(false);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShow(false);
    setDismissed(true);
    try { localStorage.setItem("jarvis_pwa_dismissed", "1"); } catch {}
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 140,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,5,10,0.97)",
        border: "1px solid var(--neon-cyan)",
        borderRadius: 14,
        padding: "16px 22px",
        zIndex: 9998,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
        boxShadow: "0 0 24px rgba(0,245,255,0.4)",
        animation: "fade-in .3s ease",
        maxWidth: "min(340px, 90vw)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28 }}>⚡</span>
        <div>
          <div
            style={{
              fontFamily: "Orbitron,sans-serif",
              fontSize: 13,
              color: "var(--neon-cyan)",
              letterSpacing: "0.1em",
            }}
          >
            INSTALAR JARVIS
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              fontFamily: "JetBrains Mono,monospace",
              marginTop: 2,
            }}
          >
            Acesso rapido direto da tela inicial
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <button
          onClick={install}
          style={{
            flex: 1,
            background: "rgba(0,245,255,0.15)",
            border: "1px solid var(--neon-cyan)",
            color: "var(--neon-cyan)",
            fontFamily: "Orbitron,sans-serif",
            fontSize: 11,
            letterSpacing: "0.1em",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all .2s",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--glow-cyan)";
            (e.currentTarget as HTMLElement).style.background = "rgba(0,245,255,0.25)";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "";
            (e.currentTarget as HTMLElement).style.background = "rgba(0,245,255,0.15)";
          }}
        >
          {deferredPrompt ? "ADICIONAR" : "COMO INSTALAR"}
        </button>
        <button
          onClick={dismiss}
          style={{
            background: "transparent",
            border: "1px solid var(--border-glow)",
            color: "var(--text-muted)",
            cursor: "pointer",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
            transition: "all .2s",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-active)";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-glow)";
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

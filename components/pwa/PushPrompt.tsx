"use client";
import { useEffect, useState, useCallback } from "react";

// Generate a VAPID key pair for push. In production this comes from your server.
// For now we use a placeholder — the server-side /api/push/subscribe endpoint
// is where real VAPID validation happens.
const VAPID_PUBLIC_KEY =
  "BEl62iXVY5kL1zMrH2g8KqJhFhNxTmK3vR7wP9sAaLdQcVyBnM6jZ4uWxCfDgEhJkL0pNmR3sT5vV8yA1bC2dE";

export function PushPrompt() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");

  useEffect(() => {
    // Only show after PWA is installed
    if (!window.matchMedia("(display-mode: standalone)").matches) return;

    // Check if already granted or denied
    if (!("Notification" in window)) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "granted") {
      setStatus("granted");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    // Check if user has dismissed before
    try {
      if (localStorage.getItem("jarvis_push_dismissed") === "1") return;
    } catch {}

    // Show prompt after a delay
    const timer = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        setStatus("granted");
        setShow(false);

        // Subscribe the service worker to push
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
        });

        // Send subscription to server
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });

        // Show a test notification
        reg.showNotification("J.A.R.V.I.S. Nexus", {
          body: "Notificacoes ativadas! Voce recebera alertas do Jarvis.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200],
          tag: "jarvis-welcome",
        });
      } else {
        setStatus("denied");
        setShow(false);
      }
    } catch (err) {
      console.warn("[PushPrompt] Permission error:", err);
      setStatus("denied");
      setShow(false);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem("jarvis_push_dismissed", "1"); } catch {}
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 200,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,5,10,0.97)",
        border: "1px solid var(--neon-purple)",
        borderRadius: 14,
        padding: "16px 22px",
        zIndex: 9997,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center",
        boxShadow: "0 0 24px rgba(191,0,255,0.3)",
        animation: "fade-in .3s ease",
        maxWidth: "min(340px, 90vw)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28 }}>🔔</span>
        <div>
          <div
            style={{
              fontFamily: "Orbitron,sans-serif",
              fontSize: 13,
              color: "var(--neon-purple)",
              letterSpacing: "0.1em",
            }}
          >
            ALERTAS INTELIGENTES
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              fontFamily: "JetBrains Mono,monospace",
              marginTop: 2,
            }}
          >
            Receba notificacoes de respostas, deploys e alertas
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <button
          onClick={requestPermission}
          style={{
            flex: 1,
            background: "rgba(191,0,255,0.12)",
            border: "1px solid var(--neon-purple)",
            color: "var(--neon-purple)",
            fontFamily: "Orbitron,sans-serif",
            fontSize: 11,
            letterSpacing: "0.1em",
            padding: "10px 16px",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all .2s",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(191,0,255,0.4)";
            (e.currentTarget as HTMLElement).style.background = "rgba(191,0,255,0.22)";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "";
            (e.currentTarget as HTMLElement).style.background = "rgba(191,0,255,0.12)";
          }}
        >
          ATIVAR
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
          AGORA NAO
        </button>
      </div>
    </div>
  );
}

// Convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

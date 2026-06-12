"use client";
import { useEffect, useState, useCallback } from "react";

export function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then(r => {
      setReg(r);

      // New SW already waiting — show banner immediately
      if (r.waiting) setShow(true);

      r.addEventListener("updatefound", () => {
        const newSW = r.installing;
        if (!newSW) return;

        newSW.addEventListener("statechange", () => {
          if (newSW.state === "installed" && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });
    });
  }, []);

  // Check for updates every 5 minutes
  useEffect(() => {
    if (!reg) return;
    const interval = setInterval(() => {
      reg.update();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [reg]);

  const update = useCallback(() => {
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }, [reg]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,5,10,0.95)",
        border: "1px solid var(--neon-cyan)",
        borderRadius: 12,
        padding: "12px 20px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 0 20px rgba(0,245,255,0.3)",
        animation: "fade-in .3s ease",
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "var(--text-primary)",
          fontFamily: "JetBrains Mono,monospace",
        }}
      >
        🚀 Nova versão disponível
      </span>
      <button
        onClick={update}
        style={{
          background: "rgba(0,245,255,0.15)",
          border: "1px solid var(--neon-cyan)",
          color: "var(--neon-cyan)",
          fontFamily: "Orbitron,sans-serif",
          fontSize: 10,
          letterSpacing: "0.1em",
          padding: "6px 14px",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        ATUALIZAR
      </button>
      <button
        onClick={() => setShow(false)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        ✕
      </button>
    </div>
  );
}

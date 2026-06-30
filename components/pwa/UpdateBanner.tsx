"use client";
import { useEffect, useState, useCallback } from "react";

type LatestVersion = {
  sha: string;
  message: string;
  createdAt: string | null;
};

export function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  const [latest, setLatest] = useState<LatestVersion | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let active = true;

    const checkLatestVersion = async () => {
      try {
        const response = await fetch("/api/version/latest", { cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json();
        const currentSha = process.env.NEXT_PUBLIC_COMMIT_SHA;
        const dismissedSha = sessionStorage.getItem("jarvis:update-dismissed");
        const latestSha = typeof payload?.sha === "string" ? payload.sha : "";

        if (!active || !currentSha || !latestSha || latestSha === currentSha || dismissedSha === latestSha) {
          return;
        }

        setLatest({
          sha: latestSha,
          message: payload.message || "Nova versão disponível",
          createdAt: payload.createdAt || null,
        });
        setShow(true);
      } catch (error) {
        console.warn("[PWA] Falha ao verificar versão:", (error as Error).message);
      }
    };

    const setup = async () => {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const readyRegistration = await navigator.serviceWorker.ready;

      if (!active) return;
      setReg(readyRegistration || registration);
      await checkLatestVersion();
    };

    setup().catch((error) => {
      console.warn("[PWA] Falha ao registrar service worker:", (error as Error).message);
    });

    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    if (latest?.sha) {
      sessionStorage.setItem("jarvis:update-dismissed", latest.sha);
    }
    setShow(false);
  }, [latest?.sha]);

  const update = useCallback(async () => {
    if (!reg) {
      window.location.reload();
      return;
    }

    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });

    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }

    await reg.update();

    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }

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
        🚀 {latest?.message || "Nova versão disponível"}
      </span>
      {latest?.createdAt && (
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "JetBrains Mono,monospace",
          }}
        >
          {new Date(latest.createdAt).toLocaleString("pt-BR")}
        </span>
      )}
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
        onClick={dismiss}
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

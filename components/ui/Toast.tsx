"use client";
import type { Toast } from "@/types";

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 9000, pointerEvents: "none", alignItems: "center" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: "var(--bg-secondary)", border: `1px solid ${t.type === "success" ? "rgba(0,255,136,.4)" : t.type === "error" ? "rgba(255,0,128,.4)" : "rgba(0,245,255,.3)"}`,
          color: t.type === "success" ? "var(--neon-green)" : t.type === "error" ? "var(--neon-pink)" : "var(--neon-cyan)",
          padding: "8px 16px", borderRadius: 20, fontSize: 12, fontFamily: "JetBrains Mono,monospace",
          animation: t.out ? "fade-in .2s ease reverse forwards" : "fade-in .25s ease forwards",
          pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,.5)",
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

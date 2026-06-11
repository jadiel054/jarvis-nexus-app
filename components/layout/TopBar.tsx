"use client";
import { useChatStore, useUIStore } from "@/store";

export function TopBar() {
  const { agentStatus, tokenCount } = useChatStore();
  const { setSidebarOpen, setShowSettings, ttsEnabled, setTtsEnabled, showToast } = useUIStore();

  const statusLabel = agentStatus === "idle" ? "ONLINE" : agentStatus === "thinking" ? "PROCESSANDO" : "RESPONDENDO";

  const toggleTTS = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    showToast(next ? "🔊 Voz ativada" : "🔇 Voz desativada", "info");
  };

  return (
    <div style={{ background: "rgba(2,2,8,.9)", borderBottom: "1px solid var(--border-glow)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Mobile sidebar toggle */}
        <button onClick={() => setSidebarOpen(true)}
          style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", cursor: "pointer", borderRadius: 6, padding: "4px 8px", fontSize: 16, display: "none" }}>
          ☰
        </button>

        {/* Status indicator */}
        {agentStatus === "idle" ? (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--neon-green)", boxShadow: "0 0 8px var(--neon-green)", animation: "glow-pulse 2s ease-in-out infinite" }} />
        ) : agentStatus === "streaming" ? (
          <div className="ldrs-waveform"><span/><span/><span/><span/><span/></div>
        ) : (
          <div className="ldrs-dot-pulse"><span/><span/><span/></div>
        )}
        <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 11, color: "var(--neon-cyan)", letterSpacing: "0.15em" }}>
          {statusLabel}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {tokenCount > 0 && (
          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "var(--text-muted)" }}>
            ~{tokenCount.toLocaleString()} tokens
          </div>
        )}
        <button onClick={toggleTTS}
          style={{ background: ttsEnabled ? "rgba(191,0,255,.08)" : "transparent", border: `1px solid ${ttsEnabled ? "rgba(191,0,255,.5)" : "var(--border-glow)"}`, color: ttsEnabled ? "var(--neon-purple)" : "var(--text-secondary)", fontFamily: "JetBrains Mono,monospace", fontSize: 10, padding: "4px 10px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all .2s" }}>
          {ttsEnabled ? "🔊" : "🔇"} <span>VOZ</span>
        </button>
        <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px solid var(--border-glow)", padding: "4px 10px", borderRadius: 4 }}>
          claude-sonnet-4-6
        </div>
      </div>
    </div>
  );
}

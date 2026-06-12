"use client";
import { useChatStore, useUIStore } from "@/store";

const PROVIDER_MODELS: Record<string, string[]> = {
  anthropic: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"],
  openrouter: ["qwen/qwen3-235b-a22b:free", "deepseek/deepseek-r1:free", "google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free"],
  openai: ["gpt-4o", "gpt-4o-mini"],
  gemini: ["gemini-2.0-flash-exp", "gemini-1.5-pro"],
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  groq: "Groq",
  openrouter: "OpenRouter",
  openai: "OpenAI",
  gemini: "Gemini",
};

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "🤖",
  groq: "⚡",
  openrouter: "🔀",
  openai: "🧠",
  gemini: "🌟",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "var(--neon-cyan)",
  groq: "#ff9d00",
  openrouter: "#a855f7",
  openai: "#10a37f",
  gemini: "#4285f4",
};

const selectStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-glow)",
  color: "var(--text-primary)",
  fontFamily: "JetBrains Mono,monospace",
  fontSize: 10,
  padding: "4px 6px",
  borderRadius: 4,
  outline: "none",
  cursor: "pointer",
  maxWidth: 130,
};

export function TopBar() {
  const { agentStatus, tokenCount } = useChatStore();
  const {
    setSidebarOpen,
    setShowSettings,
    ttsEnabled,
    setTtsEnabled,
    showToast,
    aiProvider,
    aiModel,
    setAiProvider,
    setAiModel,
  } = useUIStore();

  const statusLabel = agentStatus === "idle" ? "ONLINE" : agentStatus === "thinking" ? "PROCESSANDO" : "RESPONDENDO";
  const isActive = agentStatus !== "idle";
  const providerColor = PROVIDER_COLORS[aiProvider] || "var(--neon-cyan)";
  const providerIcon = PROVIDER_ICONS[aiProvider] || "🤖";

  const toggleTTS = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    showToast(next ? "🔊 Voz ativada" : "🔇 Voz desativada", "info");
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    setAiProvider(p);
    const models = PROVIDER_MODELS[p];
    if (models && models.length > 0) {
      setAiModel(models[0]);
    }
  };

  const models = PROVIDER_MODELS[aiProvider] || [];

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

        {/* Active provider indicator — shows during streaming/thinking */}
        {isActive && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: `${providerColor}10`, border: `1px solid ${providerColor}40`,
            borderRadius: 10, padding: "2px 8px",
            animation: "fade-in .3s ease",
          }}>
            <span style={{ fontSize: 11 }}>{providerIcon}</span>
            <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: providerColor }}>
              {PROVIDER_LABELS[aiProvider]}
            </span>
            <div className="ldrs-ring" style={{ width: 10, height: 10, color: providerColor }} />
          </div>
        )}
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

        {/* Provider + Model selector */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <select value={aiProvider} onChange={handleProviderChange} style={selectStyle}>
            {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{PROVIDER_ICONS[k]} {v}</option>
            ))}
          </select>
          <select value={aiModel} onChange={e => setAiModel(e.target.value)} style={selectStyle}>
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

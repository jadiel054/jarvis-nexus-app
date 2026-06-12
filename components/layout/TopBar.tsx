"use client";
import { useChatStore, useUIStore } from "@/store";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const PROVIDER_MODELS: Record<string, string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"],
  anthropic: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  openrouter: ["qwen/qwen3-235b-a22b:free", "deepseek/deepseek-r1:free", "google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free"],
  openai: ["gpt-4o", "gpt-4o-mini"],
  gemini: ["gemini-2.0-flash-exp", "gemini-1.5-pro"],
};

const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  anthropic: "Anthropic",
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
    toggleSidebar,
    setShowSettings,
    ttsEnabled,
    setTtsEnabled,
    showToast,
    aiProvider,
    aiModel,
    setAiProvider,
    setAiModel,
  } = useUIStore();
  const bp = useBreakpoint();

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";

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
    <div style={{ background: "rgba(2,2,8,.9)", borderBottom: "1px solid var(--border-glow)", padding: isMobile ? "10px 12px" : "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10 }}>
        {/* Hamburger — visible on mobile and tablet */}
        {(isMobile || isTablet) && (
          <button onClick={toggleSidebar}
            style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", cursor: "pointer", borderRadius: 6, padding: "4px 8px", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
            ☰
          </button>
        )}

        {/* Status indicator */}
        {agentStatus === "idle" ? (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--neon-green)", boxShadow: "0 0 8px var(--neon-green)", animation: "glow-pulse 2s ease-in-out infinite", flexShrink: 0 }} />
        ) : agentStatus === "streaming" ? (
          <div className="ldrs-waveform"><span/><span/><span/><span/><span/></div>
        ) : (
          <div className="ldrs-dot-pulse"><span/><span/><span/></div>
        )}

        {/* Status label — hidden on mobile if streaming (save space) */}
        {!(isMobile && isActive) && (
          <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: isMobile ? 10 : 11, color: "var(--neon-cyan)", letterSpacing: "0.15em", whiteSpace: "nowrap" }}>
            {isMobile ? statusLabel.slice(0, 3) : statusLabel}
          </span>
        )}

        {/* Active provider indicator */}
        {isActive && !isMobile && (
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

      <div style={{ display: "flex", gap: isMobile ? 4 : 8, alignItems: "center" }}>
        {/* Token count — hidden on mobile */}
        {tokenCount > 0 && !isMobile && (
          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            ~{tokenCount.toLocaleString()} tokens
          </div>
        )}

        {/* TTS button */}
        <button onClick={toggleTTS}
          style={{ background: ttsEnabled ? "rgba(191,0,255,.08)" : "transparent", border: `1px solid ${ttsEnabled ? "rgba(191,0,255,.5)" : "var(--border-glow)"}`, color: ttsEnabled ? "var(--neon-purple)" : "var(--text-secondary)", fontFamily: "JetBrains Mono,monospace", fontSize: 10, padding: isMobile ? "4px 6px" : "4px 10px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all .2s" }}>
          {ttsEnabled ? "🔊" : "🔇"} {!isMobile && <span>VOZ</span>}
        </button>

        {/* Provider + Model selector — compact on tablet */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <select value={aiProvider} onChange={handleProviderChange} style={{ ...selectStyle, maxWidth: isTablet ? 60 : 130, fontSize: isTablet ? 9 : 10 }}>
            {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{PROVIDER_ICONS[k]} {isTablet ? "" : v}</option>
            ))}
          </select>
          {!isMobile && (
            <select value={aiModel} onChange={e => setAiModel(e.target.value)} style={{ ...selectStyle, maxWidth: isTablet ? 90 : 130 }}>
              {models.map(m => (
                <option key={m} value={m}>{m.split("/").pop()}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useChatStore, useUIStore } from "@/store";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AI_PROVIDERS, PROVIDER_OPTIONS, findProviderByModel } from "@/lib/ai/providers";

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
  const router = useRouter();

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";

  const statusLabel = agentStatus === "idle" ? "ONLINE" : agentStatus === "thinking" ? "PROCESSANDO" : "RESPONDENDO";
  const isActive = agentStatus !== "idle";
  const currentProvider = AI_PROVIDERS[aiProvider as keyof typeof AI_PROVIDERS];
  const providerColor = currentProvider?.color || "var(--neon-cyan)";
  const providerIcon = currentProvider?.icon || "🤖";

  const toggleTTS = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    showToast(next ? "🔊 Voz ativada" : "🔇 Voz desativada", "info");
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    setAiProvider(p);
    const models = AI_PROVIDERS[p as keyof typeof AI_PROVIDERS]?.models;
    if (models && models.length > 0) {
      setAiModel(models[0]);
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextModel = e.target.value;
    const nextProvider = findProviderByModel(nextModel);
    if (nextProvider) {
      setAiProvider(nextProvider);
    }
    setAiModel(nextModel);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

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
              {currentProvider?.label || aiProvider}
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
            {PROVIDER_OPTIONS.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.icon} {isTablet ? "" : provider.label}</option>
            ))}
          </select>
          {!isMobile && (
            <select value={aiModel} onChange={handleModelChange} style={{ ...selectStyle, maxWidth: isTablet ? 90 : 220 }}>
              {PROVIDER_OPTIONS.map((provider) => (
                <optgroup key={provider.id} label={provider.label}>
                  {provider.models.map((model) => (
                    <option key={`${provider.id}:${model}`} value={model}>
                      {model}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={handleLogout}
          title="Sair"
          style={{
            background: "none",
            border: "1px solid #2a2a3a",
            borderRadius: "6px",
            color: "#666",
            fontSize: "0.75rem",
            padding: "4px 8px",
            cursor: "pointer",
            transition: "color 0.2s, border-color 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#ff0a6c";
            (e.currentTarget as HTMLElement).style.borderColor = "#ff0a6c";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#666";
            (e.currentTarget as HTMLElement).style.borderColor = "#2a2a3a";
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

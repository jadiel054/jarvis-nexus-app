"use client";
import { useState } from "react";
import { useChatStore, useUIStore, useMemoryStore } from "@/store";
import { useBreakpoint } from "@/hooks/useBreakpoint";

function relTime(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (diff < 60000) return "Agora mesmo";
  if (m < 60) return `Ha ${m} minuto${m > 1 ? "s" : ""}`;
  if (h < 24) return `Ha ${h} hora${h > 1 ? "s" : ""}`;
  if (d === 1) return "Ontem";
  if (d < 7) return `Ha ${d} dias`;
  return new Date(ts).toLocaleDateString("pt-BR", { day:"numeric", month:"short", year:"numeric" });
}

export function Sidebar() {
  const { conversations, activeConvId, newConversation, deleteConversation, renameConversation, pinConversation, setActiveConv } = useChatStore();
  const { sidebarOpen, setSidebarOpen, toggleSidebar, setShowSettings, setShowMemories, setShowIntegrations, showToast, convSearch, setConvSearch } = useUIStore();
  const { memories } = useMemoryStore();
  const bp = useBreakpoint();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";
  const sidebarWidth = isMobile ? 260 : isTablet ? 60 : 260;

  const sorted = [...conversations]
    .sort((a,b) => (b.pinned ? 1:0) - (a.pinned ? 1:0) || b.updated_at - a.updated_at)
    .filter(c => !convSearch || c.title.toLowerCase().includes(convSearch.toLowerCase()));

  const exportConv = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    const md = [`# ${conv.title}`, `*${new Date().toLocaleString("pt-BR")}*`, "", ...conv.messages.map(m => `**${m.role === "user" ? "Jadiel" : "Jarvis"}:** ${m.content}`)].join("\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = `${conv.title.replace(/\s+/g,"-")}.md`;
    a.click();
    showToast("Conversa exportada ✓", "success");
  };

  const asideContent = (
    <aside style={{
      width: sidebarWidth, flexShrink: 0, background: "rgba(2,2,8,.97)", borderRight: "1px solid var(--border-glow)",
      display: "flex", flexDirection: "column", padding: isTablet ? "16px 6px" : "16px 12px", gap: isTablet ? 8 : 12, overflow: "hidden",
      transition: "width .25s ease, padding .25s ease",
      height: isMobile ? "100vh" : "100%",
    }}>
      {/* Logo */}
      {!isTablet && (
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 18, fontWeight: 900, color: "var(--neon-cyan)", textShadow: "var(--glow-cyan)", textAlign: "center", letterSpacing: "0.2em", animation: "glow-pulse 2s ease-in-out infinite" }}>
          J.A.R.V.I.S.
          <span style={{ fontSize: 10, color: "var(--text-secondary)", display: "block", letterSpacing: "0.15em", marginTop: 2, fontFamily: "JetBrains Mono,monospace", fontWeight: 400 }}>NEXUS v7.0</span>
        </div>
      )}
      {isTablet && (
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 22, fontWeight: 900, color: "var(--neon-cyan)", textShadow: "var(--glow-cyan)", textAlign: "center", animation: "glow-pulse 2s ease-in-out infinite", lineHeight: 1 }}>
          ⚡
        </div>
      )}

      {/* New chat button */}
      <button onClick={() => { newConversation(); showToast("Nova conversa ✓", "info"); setSidebarOpen(false); }}
        style={{ background: "transparent", border: "1px solid var(--border-active)", color: "var(--neon-cyan)", fontFamily: "Orbitron,sans-serif", fontSize: 11, padding: isTablet ? 8 : 10, borderRadius: 8, cursor: "pointer", letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}
        onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,245,255,.08)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--glow-cyan)"; }}
        onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
        {isTablet ? "+" : "+ NOVA CONVERSA"}
      </button>

      {/* Search — hidden on tablet */}
      {!isTablet && (
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-muted)", pointerEvents: "none" }}>🔍</span>
          <input value={convSearch} onChange={e => setConvSearch(e.target.value)}
            placeholder="Pesquisar conversas"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-glow)", color: "var(--text-primary)", fontFamily: "JetBrains Mono,monospace", fontSize: 11, padding: "6px 10px 6px 28px", borderRadius: 6, outline: "none", width: "100%", transition: "border-color .2s" }}
            onFocus={e => { e.target.style.borderColor = "var(--border-active)"; }}
            onBlur={e => { e.target.style.borderColor = "var(--border-glow)"; }}
          />
        </div>
      )}

      {/* Conversations heading — hidden on tablet */}
      {!isTablet && (
        <>
          <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 12, color: "var(--text-primary)", letterSpacing: "0.05em", padding: "2px 2px 0" }}>
            Conversas
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.2em" }}>HISTORICO</span>
            {conversations.length > 0 && (
              <span onClick={() => { if (window.confirm("Apagar TODO o historico?")) { conversations.forEach(c => deleteConversation(c.id)); newConversation(); showToast("Historico apagado", "error"); } }}
                style={{ fontSize: 9, color: "var(--neon-pink)", cursor: "pointer", letterSpacing: 0 }}>apagar tudo</span>
            )}
          </div>
        </>
      )}

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        {sorted.map(conv => (
          <div key={conv.id} style={{ padding: isTablet ? "6px 4px" : "8px 10px", borderRadius: 8, cursor: "pointer", border: `1px solid ${conv.id === activeConvId ? "var(--border-glow)" : "transparent"}`, background: conv.id === activeConvId ? "rgba(0,245,255,.06)" : undefined, display: "flex", alignItems: "center", gap: 4, position: "relative", transition: "all .2s", justifyContent: isTablet ? "center" : undefined }}
            onMouseOver={e => { if (conv.id !== activeConvId) { (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"; } }}
            onMouseOut={e => { if (conv.id !== activeConvId) { (e.currentTarget as HTMLElement).style.background = ""; } }}>

            {conv.pinned && <span style={{ fontSize: 9, color: "var(--neon-yellow)", flexShrink: 0 }}>📌</span>}

            {isTablet ? (
              <div onClick={() => { setActiveConv(conv.id); setSidebarOpen(false); }} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, color: conv.id === activeConvId ? "var(--neon-cyan)" : "var(--text-secondary)" }}>⚡</div>
              </div>
            ) : (
              <>
                {renamingId === conv.id ? (
                  <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { renameConversation(conv.id, renameVal); setRenamingId(null); showToast("Renomeado ✓", "success"); } if (e.key === "Escape") setRenamingId(null); }}
                    onBlur={() => { renameConversation(conv.id, renameVal || conv.title); setRenamingId(null); }}
                    style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-active)", color: "var(--text-primary)", fontSize: 12, padding: "2px 6px", borderRadius: 4, outline: "none" }}
                  />
                ) : (
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => { setActiveConv(conv.id); setSidebarOpen(false); }}>
                    <div style={{ fontSize: 13, color: conv.id === activeConvId ? "var(--neon-cyan)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      ⚡ {conv.title}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", marginTop: 1 }}>
                      {relTime(conv.updated_at)}
                    </div>
                  </div>
                )}

                {/* Three dots menu */}
                <div style={{ position: "relative" }}>
                  <button onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === conv.id ? null : conv.id); }}
                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "2px 5px", borderRadius: 4, opacity: 0.6, lineHeight: 1 }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = "var(--neon-cyan)"; (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}>
                    •••
                  </button>
                  {openMenu === conv.id && (
                    <div style={{ position: "absolute", right: 0, top: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-glow)", borderRadius: 10, padding: 4, minWidth: 170, zIndex: 500, boxShadow: "0 8px 32px rgba(0,0,0,.6)", animation: "fade-in .15s ease" }}
                      onMouseLeave={() => setOpenMenu(null)}>
                      {[
                        { icon: "✏️", label: "Renomear", action: () => { setRenamingId(conv.id); setRenameVal(conv.title); setOpenMenu(null); } },
                        { icon: conv.pinned ? "📌" : "📌", label: conv.pinned ? "Desafixar" : "Fixar", action: () => { pinConversation(conv.id); setOpenMenu(null); showToast(conv.pinned ? "Desafixada" : "📌 Fixada", "info"); } },
                        { icon: "⬇️", label: "Exportar (.md)", action: () => { exportConv(conv.id); setOpenMenu(null); } },
                        { icon: "🗑️", label: "Apagar", danger: true, action: () => { deleteConversation(conv.id); setOpenMenu(null); showToast("Conversa apagada", "error"); } },
                      ].map(item => (
                        <div key={item.label} onClick={item.action}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, color: item.danger ? "var(--neon-pink)" : "var(--text-secondary)", transition: "all .15s" }}
                          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = item.danger ? "rgba(255,0,128,.08)" : "var(--bg-card-hover)"; (e.currentTarget as HTMLElement).style.color = item.danger ? "var(--neon-pink)" : "var(--text-primary)"; }}
                          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = item.danger ? "var(--neon-pink)" : "var(--text-secondary)"; }}>
                          <span style={{ width: 16, textAlign: "center" }}>{item.icon}</span> {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Nav — icons only on tablet */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border-glow)", paddingTop: 12 }}>
        {[
          { icon: "⚙", label: "Configuracoes", action: () => setShowSettings(true) },
          { icon: "🔌", label: "Integracoes", action: () => setShowIntegrations(true) },
          { icon: "🧠", label: `Memorias ${memories.length > 0 ? `(${memories.length})` : ""}`, action: () => setShowMemories(true) },
        ].map(item => (
          <div key={item.label} onClick={item.action}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", transition: "all .2s", border: "1px solid transparent", justifyContent: isTablet ? "center" : undefined }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-card)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-glow)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
            {item.icon} {!isTablet && item.label}
          </div>
        ))}
      </nav>

      {/* Close button on mobile */}
      {isMobile && (
        <button onClick={() => setSidebarOpen(false)}
          style={{ marginTop: 8, background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", cursor: "pointer", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontFamily: "JetBrains Mono,monospace" }}>
          ✕ FECHAR
        </button>
      )}
    </aside>
  );

  // Mobile: render as overlay drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,5,.7)", zIndex: 50, animation: "fade-in .2s ease" }} />
        )}
        {/* Drawer */}
        <div style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 60,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .3s ease",
        }}>
          {asideContent}
        </div>
      </>
    );
  }

  // Tablet / Desktop: inline sidebar
  return asideContent;
}

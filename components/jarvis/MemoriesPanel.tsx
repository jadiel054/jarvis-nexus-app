"use client";
import { useState } from "react";
import { useMemoryStore, useUIStore } from "@/store";

export function MemoriesPanel() {
  const { memories, evolution, deleteMemory, clearMemories } = useMemoryStore();
  const { setShowMemories, showToast } = useUIStore();
  const [tab, setTab] = useState<"memories" | "evolution">("memories");
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = search.trim()
    ? memories.filter(m => m.content.toLowerCase().includes(search.toLowerCase()) || m.category.includes(search))
    : [...memories].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const typeColors: Record<string,string> = { decision: "var(--neon-cyan)", project: "var(--neon-purple)", preference: "var(--neon-green)", context: "var(--text-secondary)", credential: "var(--neon-pink)", todo: "var(--neon-yellow)" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,5,.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", animation: "fade-in .2s ease" }}
      onClick={e => e.target === e.currentTarget && setShowMemories(false)}>
      <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-glow)", borderRadius: 16, width: "min(600px, 94vw)", maxHeight: "85vh", overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 16, color: "var(--neon-cyan)", letterSpacing: "0.1em" }}>🧠 MEMÓRIAS</span>
          <button onClick={() => setShowMemories(false)} style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", cursor: "pointer", borderRadius: 6, padding: "4px 10px" }}>✕</button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { l: "Total",     v: memories.length,                                              c: "var(--neon-cyan)" },
            { l: "Decisões",  v: memories.filter(m=>m.category==="decision").length,           c: "var(--neon-cyan)" },
            { l: "Projetos",  v: memories.filter(m=>m.category==="project").length,            c: "var(--neon-purple)" },
            { l: "Sessões",   v: evolution.filter(e=>e.type==="conversation").length,          c: "var(--neon-green)" },
          ].map(s => (
            <div key={s.l} style={{ background: "var(--bg-card)", border: "1px solid var(--border-glow)", borderRadius: 6, padding: "6px 12px", textAlign: "center" }}>
              <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 16, color: s.c }}>{s.v}</div>
              <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["memories","evolution"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: 8, border: `1px solid ${tab === t ? "var(--neon-cyan)" : "var(--border-glow)"}`, background: tab === t ? "rgba(0,245,255,.08)" : "transparent", color: tab === t ? "var(--neon-cyan)" : "var(--text-secondary)", fontFamily: "Orbitron,sans-serif", fontSize: 10, borderRadius: 6, cursor: "pointer", letterSpacing: "0.1em" }}>
              {t === "memories" ? "🧠 MEMÓRIAS" : "📈 EVOLUÇÃO"}
            </button>
          ))}
        </div>

        {tab === "memories" && (
          <>
            <input placeholder="🔍 buscar memórias..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-glow)", color: "var(--text-primary)", fontFamily: "JetBrains Mono,monospace", fontSize: 12, padding: "8px 12px", borderRadius: 6, outline: "none", width: "100%" }}
              onFocus={e => { e.target.style.borderColor = "var(--border-active)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-glow)"; }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", fontSize: 12, padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  {!search && <div className="ldrs-grid">{Array.from({length:9},(_,i) => <span key={i} />)}</div>}
                  {search ? "Nenhuma memória encontrada." : "Nenhuma memória salva ainda."}
                </div>
              )}
              {filtered.map(mem => (
                <div key={mem.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-glow)", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: typeColors[mem.category] || "var(--text-secondary)", background: "rgba(0,0,0,.3)", padding: "2px 6px", borderRadius: 3, textTransform: "uppercase" }}>{mem.category}</span>
                      {mem.project && <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: "var(--text-muted)", padding: "2px 6px", borderRadius: 3 }}>{mem.project}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{mem.content}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", marginTop: 4 }}>{new Date(mem.created_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <button onClick={() => { deleteMemory(mem.id); showToast("Memória removida", "info"); }}
                    style={{ background: "transparent", border: "1px solid rgba(255,0,128,.2)", color: "var(--neon-pink)", cursor: "pointer", borderRadius: 4, padding: "3px 7px", fontSize: 11, flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
            {memories.length > 0 && (
              confirmClear ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--neon-pink)", flex: 1 }}>Tem certeza? Apaga TODAS as memórias.</span>
                  <button onClick={() => { clearMemories(); setConfirmClear(false); showToast("Memórias apagadas", "error"); }} style={{ background: "rgba(255,0,128,.15)", border: "1px solid var(--neon-pink)", color: "var(--neon-pink)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "JetBrains Mono,monospace" }}>CONFIRMAR</button>
                  <button onClick={() => setConfirmClear(false)} style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>cancelar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} style={{ background: "transparent", border: "1px solid rgba(255,0,128,.3)", color: "var(--neon-pink)", padding: 8, borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "JetBrains Mono,monospace" }}>🗑️ LIMPAR TODAS AS MEMÓRIAS</button>
              )
            )}
          </>
        )}

        {tab === "evolution" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 420, overflowY: "auto" }}>
            {evolution.length === 0 && <div style={{ textAlign: "center", color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", fontSize: 12, padding: "20px 0" }}>Nenhuma atividade registrada ainda.</div>}
            {evolution.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border-glow)", alignItems: "flex-start" }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{e.type === "conversation" ? "💬" : e.type === "memory_saved" ? "🧠" : "⚡"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{e.summary}</div>
                  {e.tools_used !== undefined && e.tools_used > 0 && <div style={{ fontSize: 10, color: "var(--neon-cyan)", fontFamily: "JetBrains Mono,monospace" }}>{e.tools_used} tool(s)</div>}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", flexShrink: 0 }}>{new Date(e.at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

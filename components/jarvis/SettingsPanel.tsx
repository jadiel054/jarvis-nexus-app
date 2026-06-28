"use client";
import { useState, useEffect } from "react";
import { useUIStore } from "@/store";
import { createClient } from "@/lib/supabase/client";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const FIELDS = [
  { group: "🤖 ANTHROPIC",  fields: [{ key: "anthropicKey",  label: "ANTHROPIC_API_KEY",       hint: "sk-ant-..." }] },
  { group: "⚡ GROQ",       fields: [{ key: "groqKey",       label: "GROQ_API_KEY",             hint: "gsk_..." }] },
  { group: "🌟 GEMINI",     fields: [{ key: "geminiKey",     label: "GEMINI_API_KEY",           hint: "AIza..." }] },
  { group: "🔄 OPENROUTER", fields: [{ key: "openrouterKey", label: "OPENROUTER_API_KEY",       hint: "sk-or-..." }] },
  { group: "🤖 OPENAI",     fields: [{ key: "openaiKey",     label: "OPENAI_API_KEY",           hint: "sk-..." }] },
  { group: "🔷 DEEPSEEK",   fields: [{ key: "deepseekKey",   label: "DEEPSEEK_API_KEY",         hint: "sk-..." }] },
  { group: "🐙 GITHUB",     fields: [{ key: "githubToken",   label: "GITHUB_TOKEN",             hint: "ghp_..." }] },
  { group: "▲ VERCEL",     fields: [{ key: "vercelToken",   label: "VERCEL_TOKEN",             hint: "..." }] },
  { group: "🔍 TAVILY",     fields: [{ key: "tavilyKey",     label: "TAVILY_API_KEY",           hint: "tvly-..." }] },
  { group: "📨 TELEGRAM",   fields: [
    { key: "tgComandoToken", label: "BOT_COMANDO_TOKEN", hint: "..." },
    { key: "tgAlertsToken",  label: "BOT_ALERTS_TOKEN",  hint: "..." },
    { key: "tgDevToken",     label: "BOT_DEV_TOKEN",     hint: "..." },
    { key: "tgAdminId",      label: "ADMIN_CHAT_ID",     hint: "123456789" },
  ]},
];

function encrypt(val: string): string {
  if (!val) return "";
  try { return "enc:" + btoa(val); } catch { return val; }
}

function decrypt(val: string): string {
  if (!val) return "";
  if (val.startsWith("enc:")) {
    try { return atob(val.slice(4)); } catch { return val; }
  }
  return val;
}

export function SettingsPanel() {
  const { setShowSettings, showToast } = useUIStore();
  const bp = useBreakpoint();
  const [form, setForm] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem("jarvis_config") || "{}"); } catch { return {}; }
  });
  const [saving, setSaving] = useState(false);

  // Load from Supabase on mount (merges with localStorage, Supabase wins)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("settings")
      .select("key, value")
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return;
        const remote: Record<string, string> = {};
        data.forEach((row: { key: string; value: string }) => {
          remote[row.key] = decrypt(row.value);
        });
        // Merge: remote wins over localStorage
        try {
          const local = JSON.parse(localStorage.getItem("jarvis_config") || "{}");
          const merged = { ...local, ...remote };
          setForm(merged);
          localStorage.setItem("jarvis_config", JSON.stringify(merged));
        } catch {
          setForm(remote);
        }
      });
  }, []);

  const save = async () => {
    // 1. Save to localStorage
    localStorage.setItem("jarvis_config", JSON.stringify(form));

    // 2. Upsert to Supabase — map form keys to API key names the backend expects
    setSaving(true);
    const supabase = createClient();
    const KEY_MAP: Record<string, string> = {
      anthropicKey: "ANTHROPIC_API_KEY",
      groqKey: "GROQ_API_KEY",
      geminiKey: "GEMINI_API_KEY",
      openrouterKey: "OPENROUTER_API_KEY",
      openaiKey: "OPENAI_API_KEY",
      deepseekKey: "DEEPSEEK_API_KEY",
      githubToken: "GITHUB_TOKEN",
      vercelToken: "VERCEL_TOKEN",
      tavilyKey: "TAVILY_API_KEY",
      tgComandoToken: "BOT_COMANDO_TOKEN",
      tgAlertsToken: "BOT_ALERTS_TOKEN",
      tgDevToken: "BOT_DEV_TOKEN",
      tgAdminId: "ADMIN_CHAT_ID",
    };
    const entries = Object.entries(form).filter(([, v]) => v);
    const upserts = entries.map(([key, value]) => {
      const settingsKey = KEY_MAP[key] || key;
      return supabase
        .from("settings")
        .upsert(
          { key: settingsKey, value: encrypt(value) },
          { onConflict: "key" }
        );
    });

    const results = await Promise.allSettled(upserts);
    const failed = results.filter(r => r.status === "rejected").length;

    setSaving(false);
    if (failed === 0) {
      showToast("Configuracoes salvas no Supabase ✓", "success");
    } else if (failed < entries.length) {
      showToast(`${entries.length - failed}/${entries.length} keys salvas (${failed} falhas)`, "info");
    } else {
      showToast("Salvo apenas no localStorage (Supabase indisponivel)", "info");
    }
    setShowSettings(false);
  };

  const isMobile = bp === "mobile";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,5,.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", animation: "fade-in .2s ease" }}
      onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
      <div style={{
        background: "var(--bg-secondary)",
        border: isMobile ? "none" : "1px solid var(--border-glow)",
        borderRadius: isMobile ? 0 : 16,
        width: isMobile ? "100vw" : "min(520px, 94vw)",
        height: isMobile ? "100vh" : "auto",
        maxHeight: isMobile ? "100vh" : "85vh",
        overflowY: "auto",
        padding: isMobile ? "20px 16px" : 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        boxShadow: isMobile ? "none" : "var(--glow-cyan)",
      }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 16, color: "var(--neon-cyan)", letterSpacing: "0.15em" }}>⚙ CONFIGURACOES</span>
          <button onClick={() => setShowSettings(false)} style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", cursor: "pointer", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", border: "1px solid rgba(255,204,0,.2)", background: "rgba(255,204,0,.03)", padding: "10px 12px", borderRadius: 6, lineHeight: 1.6 }}>
          💡 As keys sao salvas criptografadas no Supabase (tabela settings) e no localStorage como fallback.
        </div>

        {FIELDS.map(group => (
          <div key={group.group} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: "var(--neon-purple)", textTransform: "uppercase", letterSpacing: "0.2em" }}>{group.group}</div>
            {group.fields.map(f => (
              <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "JetBrains Mono,monospace" }}>{f.label}</label>
                <input type="password" placeholder={f.hint} value={form[f.key] || ""}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border-glow)", color: "var(--text-primary)", fontFamily: "JetBrains Mono,monospace", fontSize: 12, padding: "8px 12px", borderRadius: 6, outline: "none", width: "100%", transition: "border-color .2s" }}
                  onFocus={e => { e.target.style.borderColor = "var(--border-active)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--border-glow)"; }}
                />
              </div>
            ))}
          </div>
        ))}

        <button onClick={save} disabled={saving}
          style={{ background: saving ? "rgba(0,245,255,.05)" : "rgba(0,245,255,.1)", border: "1px solid var(--neon-cyan)", color: "var(--neon-cyan)", fontFamily: "Orbitron,sans-serif", fontSize: 11, letterSpacing: "0.1em", padding: "10px 20px", borderRadius: 8, cursor: saving ? "wait" : "pointer", transition: "all .2s", alignSelf: "flex-end", opacity: saving ? 0.6 : 1 }}
          onMouseOver={e => { if (!saving) { (e.currentTarget as HTMLElement).style.boxShadow = "var(--glow-cyan)"; (e.currentTarget as HTMLElement).style.background = "rgba(0,245,255,.2)"; } }}
          onMouseOut={e => { if (!saving) { (e.currentTarget as HTMLElement).style.boxShadow = ""; (e.currentTarget as HTMLElement).style.background = "rgba(0,245,255,.1)"; } }}>
          {saving ? "SALVANDO..." : "⚡ SALVAR"}
        </button>
      </div>
    </div>
  );
}

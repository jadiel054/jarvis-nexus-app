"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, ToolCall, Plan, SSEEvent } from "@/types";
import { useChatStore, useMemoryStore, useUIStore } from "@/store";


// ═══════════════════════════════════════════════════════════════
// KOKORO TTS ENGINE — ElevenLabs-quality, runs in browser via API
// Next.js version calls /api/tts/speak server-side
// Browser fallback: Web Speech API (pt-BR)
// ═══════════════════════════════════════════════════════════════
const JarvisTTS = {
  _enabled: false,
  _speaking: false,
  _audio: null as HTMLAudioElement | null,
  _kokoro: null as unknown,
  _kokoroLoading: false,
  _kokoroFailed: false,

  cleanText(raw: string): string {
    return (raw || "")
      .replace(/```[\s\S]{0,600}?```/g, "trecho de código")
      .replace(/`([^`\n]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/https?:\/\/\S+/g, "link")
      .replace(/[#_~]/g, "")
      .replace(/\n+/g, ". ")
      .trim()
      .slice(0, 600);
  },

  // Pré-carrega o modelo Kokoro no background
  async loadKokoro(): Promise<void> {
    if (this._kokoro || this._kokoroLoading || this._kokoroFailed) return;
    this._kokoroLoading = true;
    try {
      // Kokoro.js via CDN — ONNX 82M params, roda no browser via WebGPU/WASM
      // ~85MB download na primeira vez, cached pelo browser depois
      const url = "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";
      const mod = await (Function("u", "return import(u)"))(url);
      const KokoroClass = mod?.KokoroTTS ?? mod?.default?.KokoroTTS;
      if (!KokoroClass) throw new Error("Kokoro class not found");
      this._kokoro = await KokoroClass.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0",
        { dtype: "q8", device: "webgpu" }
      );
      console.log("[Jarvis TTS] ✅ Kokoro pronto — voz neural ativa");
    } catch (e) {
      console.warn("[Jarvis TTS] Kokoro indisponível, usando fallback:", (e as Error).message);
      this._kokoroFailed = true;
    }
    this._kokoroLoading = false;
  },

  async speak(raw: string): Promise<void> {
    if (!this._enabled) return;
    const text = this.cleanText(raw);
    if (!text) return;
    this.stop();

    // ── 1. Kokoro (padrão — grátis, neural, sem API key)
    if (!this._kokoroFailed && this._kokoro) {
      try {
        type KokoroInstance = {
          generate: (t: string, o: { voice: string }) => Promise<{ audio: ArrayBuffer }>;
        };
        const out = await (this._kokoro as KokoroInstance).generate(text, { voice: "bf_emma" });
        const ctx = new AudioContext();
        const buf = await ctx.decodeAudioData(out.audio instanceof ArrayBuffer ? out.audio : (out.audio as ArrayBuffer).slice(0));
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        this._speaking = true;
        src.onended = () => { this._speaking = false; ctx.close(); };
        return;
      } catch (e) {
        console.warn("[Jarvis TTS] Kokoro speak error:", (e as Error).message);
        this._kokoroFailed = true;
      }
    }

    // ── 2. Servidor: ElevenLabs / OpenAI TTS
    try {
      const res = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        this._audio = new Audio(url);
        this._audio.onended = () => { URL.revokeObjectURL(url); this._speaking = false; };
        this._audio.onerror = () => { this._speaking = false; this._speakFallback(text); };
        await this._audio.play();
        this._speaking = true;
        return;
      }
    } catch {}

    // ── 3. Web Speech API (último recurso)
    this._speakFallback(text);
  },

  _speakFallback(text: string): void {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "pt-BR";
    utt.rate = 0.95;
    utt.pitch = 0.85;
    const trySet = () => {
      const voices = window.speechSynthesis.getVoices();
      const best = voices.find(v => v.lang === "pt-BR" && v.localService)
        || voices.find(v => v.lang === "pt-BR")
        || voices.find(v => v.lang.startsWith("pt"));
      if (best) utt.voice = best;
      window.speechSynthesis.speak(utt);
    };
    if (window.speechSynthesis.getVoices().length > 0) trySet();
    else window.speechSynthesis.onvoiceschanged = trySet;
    this._speaking = true;
    utt.onend = () => { this._speaking = false; };
  },

  stop(): void {
    if (this._audio) { this._audio.pause(); this._audio = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this._speaking = false;
  },

  toggle(): boolean {
    this._enabled = !this._enabled;
    if (!this._enabled) this.stop();
    else if (!this._kokoro && !this._kokoroLoading && !this._kokoroFailed) {
      this.loadKokoro(); // pré-carrega no background ao ativar
    }
    return this._enabled;
  },
};
// ═══════════════════════════════════════════════════════════════
// FILE ATTACHMENT HANDLER
// Supports: images (JPEG/PNG/GIF/WebP), PDF, Word (.docx),
//           Excel (.xlsx), HTML, text files, links (URLs)
// ═══════════════════════════════════════════════════════════════
interface Attachment {
  id: string;
  name: string;
  type: "image" | "pdf" | "word" | "excel" | "html" | "text" | "link";
  size?: number;
  data?: string;       // base64 for binary files
  text?: string;       // extracted text content
  url?: string;        // for links
  preview?: string;    // image preview URL
}

async function processFile(file: File): Promise<Attachment> {
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isImage = file.type.startsWith("image/") || ["jpg","jpeg","png","gif","webp"].includes(ext);
  const isPDF = file.type === "application/pdf" || ext === "pdf";
  const isWord = file.type.includes("wordprocessingml") || ext === "docx" || ext === "doc";
  const isExcel = file.type.includes("spreadsheetml") || ext === "xlsx" || ext === "xls" || ext === "csv";
  const isHTML = file.type === "text/html" || ext === "html" || ext === "htm";
  const isText = file.type.startsWith("text/") || ["txt","md","json","ts","tsx","js","py","sql","yaml","yml","env"].includes(ext);

  if (isImage) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        resolve({ id, name: file.name, type: "image", size: file.size, data: dataUrl.split(",")[1], preview: dataUrl });
      };
      reader.readAsDataURL(file);
    });
  }

  if (isText || isHTML || isExcel || isWord || isPDF) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const type = isPDF ? "pdf" : isWord ? "word" : isExcel ? "excel" : isHTML ? "html" : "text";
        resolve({ id, name: file.name, type, size: file.size, text: content.slice(0, 50000) });
      };
      if (isText || isHTML) reader.readAsText(file);
      else reader.readAsDataURL(file);  // binary files as base64
    });
  }

  // Unknown type — read as text
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve({ id, name: file.name, type: "text", size: file.size, text: (e.target?.result as string).slice(0, 30000) });
    reader.readAsText(file);
  });
}

function buildAttachmentContext(attachments: Attachment[]): string {
  if (attachments.length === 0) return "";
  const parts = attachments.map(att => {
    if (att.type === "link") return "[Link anexado: " + att.url + "]\nBusque e analise o conteúdo desse link usando tavily_search.";
    if (att.type === "image") return "[Imagem anexada: " + att.name + "]\nA imagem foi incluída na mensagem acima em base64.";
    if (att.type === "pdf") return "[PDF anexado: " + att.name + "]\nConteúdo:\n```\n" + (att.text?.slice(0, 8000) || "") + "\n```";
    if (att.type === "word") return "[Word (.docx): " + att.name + "]\nConteúdo:\n```\n" + (att.text?.slice(0, 8000) || "") + "\n```";
    if (att.type === "excel") return "[Excel/CSV: " + att.name + "]\nDados:\n```\n" + (att.text?.slice(0, 8000) || "") + "\n```";
    if (att.type === "html") return "[HTML: " + att.name + "]\n```html\n" + (att.text?.slice(0, 8000) || "") + "\n```";
    return "[Arquivo: " + att.name + "]\n```\n" + (att.text?.slice(0, 6000) || "") + "\n```";
  });
  return "\n\n---\n**Arquivos anexados:**\n" + parts.join("\n\n");
}

// ── RELATIVE TIME ─────────────────────────────────────────────
function relTime(ts: string | number | undefined): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (diff < 60000) return "Agora mesmo";
  if (m < 60) return `Há ${m}min`;
  if (h < 24) return `Há ${h}h`;
  if (d === 1) return "Ontem";
  return new Date(ts).toLocaleDateString("pt-BR", { day:"numeric", month:"short" });
}

// ── TOOL CARD ─────────────────────────────────────────────────
const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  github_list_repos:       { label: "Listando repositórios", icon: "🐙" },
  github_get_repo:         { label: "Analisando repositório", icon: "🔬" },
  github_get_tree:         { label: "Mapeando estrutura", icon: "🗂️" },
  github_read_file:        { label: "Lendo arquivo", icon: "📄" },
  github_write_file:       { label: "Commitando arquivo", icon: "✍️" },
  github_delete_file:      { label: "Removendo arquivo", icon: "🗑️" },
  github_list_branches:    { label: "Listando branches", icon: "🌿" },
  github_create_branch:    { label: "Criando branch", icon: "🌱" },
  github_create_pr:        { label: "Criando Pull Request", icon: "🔀" },
  github_list_prs:         { label: "Listando PRs", icon: "📬" },
  github_merge_pr:         { label: "Fazendo merge", icon: "🔗" },
  github_list_issues:      { label: "Listando Issues", icon: "🐛" },
  github_create_issue:     { label: "Criando Issue", icon: "📌" },
  github_search_code:      { label: "Buscando no código", icon: "🔍" },
  github_get_commits:      { label: "Analisando commits", icon: "📜" },
  github_analyze_repo:     { label: "Análise profunda do projeto", icon: "🧠" },
  github_get_checks:       { label: "Verificando CI checks", icon: "✅" },
  github_create_workflow:  { label: "Configurando GitHub Actions", icon: "⚙️" },
  vercel_list_projects:    { label: "Listando projetos Vercel", icon: "▲" },
  vercel_trigger_deploy:   { label: "Disparando deploy", icon: "🚀" },
  vercel_get_deploy_logs:  { label: "Buscando logs de build", icon: "📋" },
  vercel_get_project_env:  { label: "Verificando variáveis", icon: "🔐" },
  tavily_search:           { label: "Pesquisando na web", icon: "🌐" },
  telegram_send_message:   { label: "Enviando via Telegram", icon: "📨" },
  memory_save:             { label: "Salvando memória", icon: "💾" },
  memory_search:           { label: "Recuperando conhecimento", icon: "💡" },
  zarith_delegate:         { label: "Delegando para Zarith", icon: "⚡" },
  jarvis_plan:             { label: "Criando plano de execução", icon: "📋" },
  jarvis_update_step:      { label: "Atualizando progresso", icon: "✅" },
};

function ToolCard({ tc }: { tc: ToolCall }) {
  // Special: memory_search with results → Knowledge card
  if (tc.name === "memory_search" && tc.status === "done") {
    const out = tc.output as Record<string,unknown>;
    if (out?._knowledge) {
      if ((out.total as number) === 0) return (
        <div style={{ padding: "5px 12px", fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: "var(--text-muted)", borderLeft: "2px solid rgba(191,0,255,0.15)" }}>
          💭 Nenhuma memória para "{(tc.input.query as string)?.slice(0,30)}"
        </div>
      );
      return <KnowledgeCard results={(out.results as Record<string,string>[])} query={tc.input.query as string} />;
    }
    if (tc.status === "running") return (
      <div style={{ padding: "8px 12px", background: "rgba(191,0,255,0.04)", border: "1px solid rgba(191,0,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid rgba(191,0,255,0.3)", borderTopColor: "var(--neon-purple)", animation: "ldrs-spin .8s linear infinite", display: "inline-block" }} />
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Recuperando conhecimento...</span>
      </div>
    );
  }

  const info = TOOL_LABELS[tc.name] || { label: tc.name, icon: "🔧" };
  const args = Object.entries(tc.input || {}).slice(0,2).map(([k,v]) => `${k}: ${String(v).slice(0,30)}`).join(" | ");

  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(0,245,255,0.15)", background: "var(--bg-card)", overflow: "hidden", marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(0,245,255,0.08)" }}>
        <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: "var(--neon-cyan)", opacity: 0.6 }}>&gt;_</span>
        <span style={{ fontSize: 14 }}>{info.icon}</span>
        <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{info.label}</span>
        {tc.status === "running" && <span className="ldrs-orbit" />}
        {tc.status === "done" && <span style={{ color: "var(--neon-green)", fontSize: 13 }}>✓</span>}
        {tc.status === "error" && <span style={{ color: "var(--neon-pink)", fontSize: 13 }}>✕</span>}
      </div>
      <div style={{ padding: "6px 12px 8px" }}>
        <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{args || "–"}</div>
        {tc.status === "done" && (tc.output as Record<string,unknown>)?.error && (
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--neon-pink)", fontFamily: "JetBrains Mono,monospace" }}>✕ {(tc.output as Record<string,string>).error}</div>
        )}
        {tc.status === "done" && !(tc.output as Record<string,unknown>)?.error && (
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--neon-green)", fontFamily: "JetBrains Mono,monospace" }}>
            ✓ {Array.isArray(tc.output) ? `${(tc.output as unknown[]).length} item(s)` : (tc.output as Record<string,unknown>)?.commit_url ? "Commitado" : (tc.output as Record<string,unknown>)?.pr_url ? "PR criado" : "Concluído"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KNOWLEDGE CARD ────────────────────────────────────────────
function KnowledgeCard({ results, query }: { results: Record<string,string>[]; query: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(191,0,255,0.25)", background: "rgba(191,0,255,0.04)", overflow: "hidden", marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(191,0,255,0.15)", border: "1px solid rgba(191,0,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--neon-purple)" }}>💡</div>
        <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>Conhecimento recuperado</span>
        <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: "var(--neon-purple)", background: "rgba(191,0,255,0.1)", padding: "2px 7px", borderRadius: 10 }}>{results.length}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", transition: "transform .2s", transform: open ? "rotate(180deg)" : undefined }}>▼</span>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid rgba(191,0,255,0.1)" }}>
          {results.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "7px 12px 7px 16px", borderBottom: i < results.length - 1 ? "1px solid rgba(191,0,255,0.06)" : undefined }}>
              <div style={{ width: 14, height: 14, border: "1.5px solid rgba(191,0,255,0.3)", borderRadius: 3, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, color: "var(--neon-purple)", textDecoration: "underline", textDecorationColor: "rgba(191,0,255,0.3)" }}>{item.content}</div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", marginTop: 2 }}>{item.category}{item.created_at && ` · ${new Date(item.created_at).toLocaleDateString("pt-BR")}`}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PLANNER PANEL ─────────────────────────────────────────────
function PlannerPanel({ plan }: { plan: Plan }) {
  const done = plan.steps.filter(s => s.status === "done").length;
  const total = plan.steps.length;
  const hasFail = plan.steps.some(s => s.status === "error");
  const allDone = done === total;
  const color = hasFail ? "var(--neon-pink)" : allDone ? "var(--neon-green)" : "var(--neon-cyan)";

  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(0,245,255,0.2)", background: "var(--bg-secondary)", overflow: "hidden", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(0,245,255,0.04)", borderBottom: "1px solid rgba(0,245,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>📋</span>
          <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 11, color: "var(--neon-cyan)", letterSpacing: "0.1em" }}>{plan.task_title}</span>
        </div>
        <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color }}>{hasFail ? "ERRO" : allDone ? "CONCLUÍDO" : `${done} / ${total}`}</span>
      </div>
      {plan.steps.map((step, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "9px 14px", borderBottom: i < plan.steps.length - 1 ? "1px solid rgba(0,245,255,0.05)" : undefined, background: step.status === "done" ? "rgba(0,255,136,0.02)" : step.status === "running" ? "rgba(0,245,255,0.04)" : step.status === "error" ? "rgba(255,0,128,0.04)" : undefined }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, border: `1.5px solid ${step.status === "done" ? "var(--neon-green)" : step.status === "running" ? "var(--neon-cyan)" : step.status === "error" ? "var(--neon-pink)" : "var(--text-muted)"}`, background: step.status === "done" ? "rgba(0,255,136,0.15)" : step.status === "error" ? "rgba(255,0,128,0.15)" : undefined, color: step.status === "done" ? "var(--neon-green)" : step.status === "running" ? "var(--neon-cyan)" : step.status === "error" ? "var(--neon-pink)" : "var(--text-muted)" }}>
            {step.status === "running" ? <span className="ldrs-quantum" style={{ width: 10, height: 10 }} /> : step.status === "done" ? "✓" : step.status === "error" ? "✕" : step.status === "skipped" ? "–" : i + 1}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: step.status === "running" ? "var(--neon-cyan)" : step.status === "error" ? "var(--neon-pink)" : step.status === "done" ? "var(--text-se

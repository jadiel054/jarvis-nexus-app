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
    // @ts-ignore
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
        {tc.status === "done" && Boolean((tc.output as Record<string,unknown>)?.error) && (
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--neon-pink)", fontFamily: "JetBrains Mono,monospace" }}>✕ {String((tc.output as Record<string,unknown>).error)}</div>
        )}
        {tc.status === "done" && !((tc.output as Record<string,unknown>)?.error) && (
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
            <div style={{ fontSize: 13, color: step.status === "running" ? "var(--neon-cyan)" : step.status === "error" ? "var(--neon-pink)" : step.status === "done" ? "var(--text-secondary)" : "var(--text-primary)" }}>{step.text}</div>
            {step.note && <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", marginTop: 2 }}>{step.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ACTION CARDS ──────────────────────────────────────────────
const ACTION_CARDS = [
  
  { icon: "🐙", title: "LISTAR REPOS", desc: "Ver seus repositórios GitHub", prompt: "Liste todos os meus repositórios no GitHub" },
  { icon: "🔬", title: "ANALISAR REPO", desc: "Análise profunda de um projeto", prompt: "Analise o repositório jadiel054/jarvis-nexus-app" },
  { icon: "🗂️", title: "MAPEAR PROJETO", desc: "Estrutura completa de arquivos", prompt: "Mapeie a estrutura do repo jadiel054/zarith-saas-web" },
  { icon: "🌐", title: "PESQUISAR", desc: "Busca web em tempo real", prompt: "Pesquise sobre as novidades do Next.js 15" },
];

// ── MAIN COMPONENT ────────────────────────────────────────────
export function ChatInterface() {
  const { messages, agentStatus, streamingText, addMessage, updateMessage, setAgentStatus, setStreamingText, persistMessages } = useChatStore();
  const { addMemory, addEvolutionEntry } = useMemoryStore();
  const { showToast, activePlan, setActivePlan, updatePlanStep } = useUIStore();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || isLoading) return;

    setInput("");
    setIsLoading(true);
    setAgentStatus("thinking");
    setActivePlan(null);

    // Build display text + attachment context
    const attContext = buildAttachmentContext(attachments);
    const fullUserText = userText + attContext;

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: userText + (attachments.length > 0 ? `

📎 ${attachments.map(a => a.type === "link" ? a.url : a.name).join(", ")}` : ""), created_at: new Date().toISOString() };
    addMessage(userMsg);

    const assistantId = `a_${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", toolCalls: [], narrations: [], streaming: true };
    addMessage(assistantMsg);

    let finalText = "";
    let allToolCalls: ToolCall[] = [];
    let allNarrations: { after_index: number; text: string }[] = [];
    let currentPlan: Plan | null = null;

    try {
      // Build messages for API (only user/assistant roles)
      // Last user message includes attachment context for the model
      const historyMessages = messages
        .filter(m => m.role === "user" || (m.role === "assistant" && m.content))
        .map(m => ({ role: m.role, content: m.content }));
      const apiMessages = [
        ...historyMessages,
        { role: "user" as const, content: fullUserText }
      ];

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      setAgentStatus("streaming");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: SSEEvent;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          switch (event.type) {
            case "thinking": {
              if (event.content) {
                allNarrations = [...allNarrations, { after_index: allToolCalls.length, text: event.content }];
                updateMessage(assistantId, { narrations: [...allNarrations] });
              }
              break;
            }
            case "plan": {
              if (event.plan) {
                currentPlan = event.plan;
                setActivePlan(event.plan);
                updateMessage(assistantId, { plan: event.plan });
              }
              break;
              }
            case "plan_update": {
              if (currentPlan && event.step_index !== undefined && event.status) {
                updatePlanStep(event.step_index, event.status, event.note);
                const updatedSteps = currentPlan.steps.map((s, i) => i === event.step_index ? { ...s, status: event.status as "pending"|"running"|"done"|"error"|"skipped", note: event.note } : s);
                currentPlan = { ...currentPlan, steps: updatedSteps };
                updateMessage(assistantId, { plan: currentPlan });
              }
              break;
            }
            case "tool_use": {
              if (event.id && event.name) {
                // Check if there was narration before this tool
                const tc: ToolCall = { id: event.id, name: event.name, input: event.input || {}, status: "running" };
                allToolCalls = [...allToolCalls, tc];
                // Auto-advance plan step
                if (currentPlan) {
                  const pendingIdx = currentPlan.steps.findIndex(s => s.status === "pending");
                  if (pendingIdx !== -1) {
                    updatePlanStep(pendingIdx, "running");
                    const updatedSteps = currentPlan.steps.map((s, i) => i === pendingIdx ? { ...s, status: "running" as const } : s);
                    currentPlan = { ...currentPlan, steps: updatedSteps };
                  }
                }
                updateMessage(assistantId, { toolCalls: [...allToolCalls] });
              }
              break;
            }
            case "tool_result": {
              if (event.id) {
                const failed = (event.content as unknown as Record<string,unknown>)?.error;
                allToolCalls = allToolCalls.map(tc => tc.id === event.id ? { ...tc, status: failed ? "error" : "done", output: event.content } : tc);
                // Advance plan step
                if (currentPlan) {
                  const runningIdx = currentPlan.steps.findIndex(s => s.status === "running");
                  if (runningIdx !== -1) {
                    const newStatus = failed ? "error" : "done";
                    updatePlanStep(runningIdx, newStatus);
                    const updatedSteps = currentPlan.steps.map((s, i) => i === runningIdx ? { ...s, status: newStatus as const } : s);
                    currentPlan = { ...currentPlan, steps: updatedSteps };
                  }
                }
                updateMessage(assistantId, { toolCalls: [...allToolCalls] });
              }
              break;
            }
            case "response": {
              if (event.content) {
                finalText += event.content;
                setStreamingText(finalText);
              }
              break;
            }
            case "done": {
              // Auto-speak with TTS if enabled
              if (ttsEnabled && finalText) {
                JarvisTTS.speak(finalText);
              }
              // Finalize plan
              if (currentPlan) {
                const finalSteps = currentPlan.steps.map(s => s.status === "running" ? { ...s, status: "done" as const } : s);
                currentPlan = { ...currentPlan, steps: finalSteps };
                setActivePlan(currentPlan);
              }
              updateMessage(assistantId, { content: finalText, toolCalls: allToolCalls, narrations: allNarrations, plan: currentPlan || undefined, streaming: false });
              setStreamingText("");
              persistMessages();

              // Add to evolution log
              addEvolutionEntry({ at: new Date().toISOString(), type: "conversation", summary: userText.slice(0, 60), tools_used: allToolCalls.length });

              // Token estimate
              const est = Math.ceil((finalText.length + userText.length) / 4);
              useChatStore.getState().setTokenCount(est);
              break;
            }
            case "error": {
              showToast(`Erro: ${event.message?.slice(0,60)}`, "error");
              updateMessage(assistantId, { content: `❌ ${event.message}`, streaming: false });
              setStreamingText("");
              break;
            }
          }
        }
      }
    } catch (err) {
      showToast(`Falhou: ${(err as Error).message}`, "error");
      updateMessage(assistantId, { content: `❌ ${(err as Error).message}`, streaming: false });
      setStreamingText("");
    }

    setAttachments([]);
    setIsLoading(false);
    setAgentStatus("idle");
    inputRef.current?.focus();
  }, [input, isLoading, messages, addMessage, updateMessage, setAgentStatus, setStreamingText, setActivePlan, updatePlanStep, persistMessages, addEvolutionEntry, showToast]);

  // Sync TTS engine with store state
  useEffect(() => {
    if (JarvisTTS._enabled !== ttsEnabled) {
      JarvisTTS._enabled = ttsEnabled;
      if (!ttsEnabled) JarvisTTS.stop();
    }
  }, [ttsEnabled]);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }} onScroll={handleScroll}>

        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "40px 20px", animation: "fade-in .6s ease forwards" }}>
            <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: "clamp(24px,4vw,42px)", fontWeight: 900, color: "var(--neon-cyan)", textShadow: "var(--glow-cyan)", letterSpacing: "0.2em", textAlign: "center" }}>
              J.A.R.V.I.S.
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
              Sistemas online. Aguardando instruções, Jadiel.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, width: "100%", maxWidth: 600 }}>
              {ACTION_CARDS.map((card, i) => (
                <div key={i} onClick={() => sendMessage(card.prompt)} style={{ background: "var(--bg-card)", border: "1px solid var(--border-glow)", borderRadius: 12, padding: 16, cursor: "pointer", transition: "all .25s ease" }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,245,255,0.4)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--glow-cyan)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-glow)"; (e.currentTarget as HTMLElement).style.boxShadow = ""; (e.currentTarget as HTMLElement).style.transform = ""; }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{card.icon}</div>
                  <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 11, color: "var(--neon-cyan)", marginBottom: 4 }}>{card.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{card.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ animation: "fade-in .3s ease forwards" }}>
            <div style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 12 }}>
              {/* Avatar */}
              <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, border: "1px solid var(--border-glow)", background: msg.role === "assistant" ? "rgba(0,245,255,0.08)" : "rgba(191,0,255,0.08)", color: msg.role === "assistant" ? "var(--neon-cyan)" : "var(--neon-purple)", boxShadow: msg.role === "assistant" ? "var(--glow-cyan)" : undefined }}>
                {msg.role === "assistant" ? "⚡" : "J"}
              </div>
              {/* Bubble */}
              <div style={{ maxWidth: "min(70%, 600px)", padding: "12px 16px", borderRadius: msg.role === "assistant" ? "4px 12px 12px 12px" : "12px 4px 12px 12px", border: "1px solid var(--border-glow)", background: msg.role === "user" ? "rgba(0,245,255,0.06)" : "var(--bg-card)", fontSize: 14, lineHeight: 1.6 }}>
                {msg.role === "assistant" ? (
                  <div className="jarvis-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.streaming ? streamingText : msg.content}
                    </ReactMarkdown>
                    {msg.streaming && <span className="jarvis-cursor">▋</span>}
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            </div>

            {/* Plan + tools + narrations */}
            {msg.role === "assistant" && (msg.plan || (msg.toolCalls && msg.toolCalls.length > 0)) && (
              <div style={{ marginLeft: 44, marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                {msg.plan && <PlannerPanel plan={msg.plan} />}
                {(() => {
                  const visibleTools = (msg.toolCalls || []).filter(tc => tc.name !== "jarvis_plan" && tc.name !== "jarvis_update_step");
                  if (visibleTools.length === 0 && (!msg.narrations || msg.narrations.length === 0)) return null;

                  const narMap: Record<number, string[]> = {};
                  (msg.narrations || []).forEach(n => { narMap[n.after_index] = [...(narMap[n.after_index] || []), n.text]; });

                  const items: { type: "tool" | "narration"; data: ToolCall | string; key: string }[] = [];
                  (narMap[0] || []).forEach((text, i) => items.push({ type: "narration", data: text, key: `n-pre-${i}` }));
                  visibleTools.forEach((tc, i) => {
                    items.push({ type: "tool", data: tc, key: tc.id });
                    (narMap[i + 1] || []).forEach((text, j) => items.push({ type: "narration", data: text, key: `n-${i}-${j}` }));
                  });

                  return items.map(item =>
                    item.type === "narration" ? (
                      <div key={item.key} style={{ margin: "6px 0 4px", padding: "8px 12px", borderLeft: "2px solid rgba(0,245,255,0.2)", fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.6 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.data as string}</ReactMarkdown>
                      </div>
                    ) : (
                      <ToolCard key={item.key} tc={item.data as ToolCall} />
                    )
                  );
                })()}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {/* Scroll to bottom */}
      {showScrollBtn && (
        <button onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollBtn(false); }}
          style={{ position: "absolute", bottom: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "var(--bg-secondary)", border: "1px solid var(--border-active)", color: "var(--neon-cyan)", cursor: "pointer", boxShadow: "var(--glow-cyan)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, zIndex: 10, animation: "fade-in .2s ease" }}>
          ↓
        </button>
      )}

      {/* Quick hints */}
      <div style={{ padding: "4px 20px 0", display: "flex", gap: 6, flexWrap: "wrap", background: "rgba(2,2,8,.95)" }}>
        {[
          { label: "⚙ settings", cmd: "abra settings" },
          { label: "🐙 repos", cmd: "liste meus repositórios" },
          { label: "🔬 analisar", cmd: "analise o repo jadiel054/jarvis-nexus-app" },
          { label: "▲ vercel", cmd: "liste meus projetos no Vercel" },
        ].map(h => (
          <button key={h.cmd} onClick={() => sendMessage(h.cmd)}
            style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", fontFamily: "JetBrains Mono,monospace", fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer", transition: "all .2s" }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = "var(--neon-cyan)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,245,255,.4)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-glow)"; }}>
            {h.label}
          </button>
        ))}
      </div>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div style={{ background: "rgba(2,2,8,.97)", padding: "8px 20px 4px", display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border-glow)" }}>
          {attachments.map(att => (
            <div key={att.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-card)", border: "1px solid var(--border-glow)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "var(--text-secondary)", maxWidth: 200 }}>
              {att.type === "image" && att.preview ? (
                <img src={att.preview} alt={att.name} style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <span style={{ flexShrink: 0, fontSize: 14 }}>
                  {att.type === "pdf" ? "📄" : att.type === "word" ? "📝" : att.type === "excel" ? "📊" : att.type === "html" ? "🌐" : att.type === "link" ? "🔗" : "📁"}
                </span>
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {att.type === "link" ? att.url?.slice(0, 30) : att.name}
              </span>
              {att.size && <span style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>{Math.round(att.size/1024)}KB</span>}
              <button onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                style={{ background: "transparent", border: "none", color: "var(--neon-pink)", cursor: "pointer", fontSize: 12, padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Link input popup */}
      {showLinkInput && (
        <div style={{ background: "rgba(2,2,8,.97)", padding: "8px 20px", borderTop: "1px solid var(--border-glow)", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 14 }}>🔗</span>
          <input value={linkInput} onChange={e => setLinkInput(e.target.value)}
            placeholder="Cole o URL aqui... (ex: https://github.com/...)"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter" && linkInput.trim()) {
                const url = linkInput.trim().startsWith("http") ? linkInput.trim() : `https://${linkInput.trim()}`;
                setAttachments(prev => [...prev, { id: `att_${Date.now()}`, name: url, type: "link", url }]);
                setLinkInput(""); setShowLinkInput(false);
                showToast("🔗 Link adicionado", "info");
              }
              if (e.key === "Escape") { setShowLinkInput(false); setLinkInput(""); }
            }}
            style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-active)", color: "var(--text-primary)", fontFamily: "JetBrains Mono,monospace", fontSize: 12, padding: "7px 12px", borderRadius: 6, outline: "none" }}
          />
          <button onClick={() => { setShowLinkInput(false); setLinkInput(""); }}
            style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", cursor: "pointer", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>✕</button>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
        accept="image/*,.pdf,.docx,.doc,.xlsx,.xls,.csv,.html,.htm,.txt,.md,.json,.ts,.tsx,.js,.py,.sql"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) return;
          showToast(`Processando ${files.length} arquivo(s)...`, "info");
          const processed = await Promise.all(files.map(processFile));
          setAttachments(prev => [...prev, ...processed]);
          showToast(`✓ ${files.length} arquivo(s) prontos`, "success");
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      {/* Input area */}
      <div style={{ background: "rgba(2,2,8,.95)", borderTop: "1px solid var(--border-glow)", padding: "12px 20px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "var(--bg-card)", border: "1px solid var(--border-glow)", borderRadius: 12, padding: "8px 12px", transition: "border-color .2s" }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,.5)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border-glow)"; }}
          onDrop={async (e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length === 0) return;
            showToast(`Processando ${files.length} arquivo(s)...`, "info");
            const processed = await Promise.all(files.map(processFile));
            setAttachments(prev => [...prev, ...processed]);
            showToast(`✓ ${files.length} arquivo(s) prontos`, "success");
          }}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(0,245,255,.6)"; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border-glow)"; }}
          onPaste={async (e) => {
            // Paste image from clipboard
            const items = Array.from(e.clipboardData?.items || []);
            const imgItem = items.find(i => i.type.startsWith("image/"));
            if (imgItem) {
              const file = imgItem.getAsFile();
              if (file) {
                const att = await processFile(new File([file], `clipboard_${Date.now()}.png`, { type: file.type }));
                setAttachments(prev => [...prev, att]);
                showToast("📷 Imagem colada", "success");
              }
            }
          }}
        >
          {/* Attach file button */}
          <button onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo (imagem, PDF, Word, Excel, HTML, código)"
            style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", borderRadius: 7, padding: "7px 9px", cursor: "pointer", fontSize: 14, flexShrink: 0, transition: "all .2s" }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = "var(--neon-cyan)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,245,255,.4)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-glow)"; }}>
            📎
          </button>

          {/* Link button */}
          <button onClick={() => setShowLinkInput(p => !p)}
            title="Adicionar link para o Jarvis analisar"
            style={{ background: showLinkInput ? "rgba(0,245,255,.08)" : "transparent", border: `1px solid ${showLinkInput ? "rgba(0,245,255,.4)" : "var(--border-glow)"}`, color: showLinkInput ? "var(--neon-cyan)" : "var(--text-secondary)", borderRadius: 7, padding: "7px 9px", cursor: "pointer", fontSize: 14, flexShrink: 0, transition: "all .2s" }}>
            🔗
          </button>

          {/* Voice input button */}
          <button onClick={() => {
            const SR = (window as Window & typeof globalThis & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as Window & typeof globalThis & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
            if (!SR) { showToast("Voz não suportada nesse browser", "error"); return; }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const r = new (SR as new () => any)();
            r.lang = "pt-BR";
            r.onresult = (e: any) => { setInput((prev: string) => (prev ? prev + " " : "") + e.results[0][0].transcript); };
            r.onerror = () => showToast("Não foi possível capturar a voz", "error");
            r.start();
            showToast("🎤 Ouvindo...", "info", 3000);
          }} title="Falar mensagem (pt-BR)"
            style={{ background: "transparent", border: "1px solid var(--border-glow)", color: "var(--text-secondary)", borderRadius: 7, padding: "7px 9px", cursor: "pointer", fontSize: 14, flexShrink: 0, transition: "all .2s" }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = "var(--neon-cyan)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,245,255,.4)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-glow)"; }}>
            🎤
          </button>

          <textarea ref={inputRef} value={input}
            onChange={e => { setInput(e.target.value); autoResize(e.target); }}
            onKeyDown={handleKeyDown}
            placeholder={attachments.length > 0 ? `${attachments.length} arquivo(s) prontos — adicione uma mensagem...` : "Mensagem para o Jarvis... (Enter envia • Shift+Enter nova linha • arraste arquivos aqui)"}
            rows={1}
            disabled={isLoading}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 14, fontFamily: "Inter,sans-serif", resize: "none", overflow: "hidden", lineHeight: 1.5, minHeight: 24, maxHeight: 120 }}
          />

          <button onClick={() => sendMessage()} disabled={isLoading || (!input.trim() && attachments.length === 0)}
            style={{ background: "rgba(0,245,255,.1)", border: "1px solid rgba(0,245,255,.3)", color: "var(--neon-cyan)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "Orbitron,sans-serif", fontSize: 10, letterSpacing: "0.1em", transition: "all .2s", flexShrink: 0, display: "flex", alignItems: "center", gap: 6, opacity: isLoading || (!input.trim() && attachments.length === 0) ? 0.4 : 1 }}
            onMouseOver={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.boxShadow = "var(--glow-cyan)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.boxShadow = ""; }}>
            {isLoading ? <><span className="ldrs-ring" style={{ marginRight: 4 }} />PROC.</> : <>⚡ ENVIAR</>}
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)", fontFamily: "JetBrains Mono,monospace", textAlign: "center" }}>
          📎 arrastar arquivo • 🔗 link • 🎤 voz • 🔊 TTS {ttsEnabled ? "(ativo)" : "(desativado)"}
        </div>
      </div>
    </div>
  );
}

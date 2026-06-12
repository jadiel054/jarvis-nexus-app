'use client';
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
          💭 Nenhuma memória para "{ (tc.input.query as string)?.slice(0,30) }"
        </div>
      );
      return <KnowledgeCard results={(out.results as Record<string,string>[])} query={tc.input.query as string} />;
    }
  }

  const info = TOOL_LABELS[tc.name] || { label: tc.name, icon: "🔧" };
  const args = Object.entries(tc.input || {}).slice(0,2).map(([k,v]) => `${k}: ${String(v).slice(0,30)}`).join(" | ");

  return (
    <div style={{ borderRadius: 10, border: "1px solid rgba(0,245,255,0.15)", background: "var(--bg-card)", overflow: "hidden", marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(0,245,255,0.08)" }}>
        <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: "var(--neon-cyan)", opacity: 0.6 }}>{'>_'}</span>
        <span style={{ fontSize: 14 }}>{info.icon}</span>
        <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{info.label}</span>
        {tc.status === "running" && <span className="ldrs-orbit" />}
        {tc.status === "done" && <span style={{color: "#0f0", fontSize: 12}}>✓</span>}
        {tc.status === "error" && <span style={{color: "#f66", fontSize: 12}}>✕</span>}
      </div>
      {tc.status === "running" && <div style={{padding: "8px 12px", fontSize: 12, opacity: 0.7}}>Executando...</div>}
      {args && <div style={{padding: "0 12px 8px", fontSize: 11, opacity: 0.6, fontFamily: "monospace"}}>{args}</div>}
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);

  const { addMessage, getHistory } = useChatStore();
  const { saveMemory } = useMemoryStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load initial history
  useEffect(() => {
    const history = getHistory();
    if (history.length > 0) setMessages(history);
  }, [getHistory]);

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      attachments: [...attachments],
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          attachments: userMessage.attachments,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      let buffer = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split by SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "message") {
                setMessages(prev => [...prev, data.message]);
              } else if (data.type === "tool") {
                // Handle tool updates
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = await Promise.all(files.map(processFile));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const toggleTTS = () => {
    const newState = JarvisTTS.toggle();
    setTtsEnabled(newState);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-white/10 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400">Jarvis Nexus</h1>
          <p className="text-sm text-white/60">Assistente Avançado com Ferramentas</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTTS} className={`px-3 py-1 rounded text-sm ${ttsEnabled ? 'bg-green-500' : 'bg-white/10'}`}>
            {ttsEnabled ? '🔊 TTS ON' : '🔇 TTS OFF'}
          </button>
          <button onClick={toggleSidebar} className="p-2 hover:bg-white/10 rounded">
            ☰
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{scrollbarWidth: 'thin'}}>
        {messages.map((msg, i) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-zinc-800'}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert max-w-none">
                {msg.content}
              </ReactMarkdown>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.attachments.map(att => (
                    <div key={att.id} className="text-xs bg-black/30 px-2 py-1 rounded">📎 {att.name}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && <div className="text-cyan-400">Pensando...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />
          <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl">📎</button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite sua mensagem... (Shift+Enter para nova linha)"
            className="flex-1 bg-zinc-900 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-400"
          />
          <button onClick={handleSend} disabled={isLoading} className="px-8 bg-cyan-500 hover:bg-cyan-600 rounded-xl font-medium disabled:opacity-50">
            Enviar
          </button>
        </div>
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map(att => (
              <div key={att.id} className="bg-zinc-800 px-3 py-1 rounded text-xs flex items-center gap-2">
                📎 {att.name}
                <button onClick={() => removeAttachment(att.id)} className="text-red-400">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Placeholder for KnowledgeCard (add if missing)
function KnowledgeCard({ results, query }: { results: any[]; query: string }) {
  return (
    <div className="p-4 bg-zinc-900 border border-purple-500/30 rounded-xl">
      <div className="text-purple-400 text-sm mb-2">💡 Conhecimento recuperado para: {query}</div>
      <ul className="space-y-1 text-sm">
        {results.slice(0, 3).map((r, i) => (
          <li key={i} className="opacity-80">• {r.content?.slice(0, 120)}...</li>
        ))}
      </ul>
    </div>
  );
}

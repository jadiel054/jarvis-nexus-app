export const AI_PROVIDERS = {
  groq: {
    envKey: "GROQ_API_KEY",
    label: "Groq",
    icon: "⚡",
    color: "#ff9d00",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
      "mixtral-8x7b-32768",
    ],
    defaultModel: "llama-3.3-70b-versatile",
  },
  cerebras: {
    envKey: "CEREBRAS_API_KEY",
    label: "Cerebras",
    icon: "🧠",
    color: "#22c55e",
    baseUrl: "https://api.cerebras.ai/v1",
    models: ["gpt-oss-120b"],
    defaultModel: "gpt-oss-120b",
    reasoning: true, // gpt-oss-120b é reasoning model: exige max_completion_tokens e pode retornar content:null (+ campo reasoning)
  },
  openrouter: {
    envKey: "OPENROUTER_API_KEY",
    label: "OpenRouter",
    icon: "🔀",
    color: "#a855f7",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "qwen/qwen3-235b-a22b:free",
      "deepseek/deepseek-r1:free",
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
    defaultModel: "google/gemini-2.0-flash-exp:free",
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    label: "Gemini",
    icon: "🌟",
    color: "#4285f4",
    models: ["gemini-2.0-flash-exp", "gemini-1.5-pro"],
    defaultModel: "gemini-2.0-flash-exp",
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    icon: "🤖",
    color: "var(--neon-cyan)",
    models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
    defaultModel: "claude-sonnet-4-6",
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    label: "OpenAI",
    icon: "🧬",
    color: "#10a37f",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini"],
    defaultModel: "gpt-4o-mini",
  },
  deepseek: {
    envKey: "DEEPSEEK_API_KEY",
    label: "DeepSeek",
    icon: "🔷",
    color: "#2563eb",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat"],
    defaultModel: "deepseek-chat",
  },
} as const;

export type ProviderId = keyof typeof AI_PROVIDERS;

export const FALLBACK_ORDER: ProviderId[] = ["groq", "cerebras", "openrouter", "gemini", "anthropic"];

export const PROVIDER_OPTIONS = Object.entries(AI_PROVIDERS).map(([id, provider]) => ({
  id: id as ProviderId,
  ...provider,
}));

export function findProviderByModel(model: string): ProviderId | null {
  for (const [providerId, provider] of Object.entries(AI_PROVIDERS)) {
    if (provider.models.includes(model as never)) {
      return providerId as ProviderId;
    }
  }
  return null;
}

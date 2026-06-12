// app/api/ai/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { allTools } from "@/lib/tools";
import { toolExecutor } from "@/lib/agent/toolExecutor";
import { getSystemPrompt } from "@/lib/agent/systemPrompt";

export const maxDuration = 120;

// ── PROVIDER / MODEL CONFIG ──────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    envKey: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"],
    defaultModel: "llama-3.3-70b-versatile",
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
    defaultModel: "claude-sonnet-4-6",
  },
  openrouter: {
    envKey: "OPENROUTER_API_KEY",
    models: ["qwen/qwen3-235b-a22b:free", "deepseek/deepseek-r1:free", "google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free"],
    defaultModel: "google/gemini-2.0-flash-exp:free",
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    models: ["gpt-4o", "gpt-4o-mini"],
    defaultModel: "gpt-4o-mini",
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    models: ["gemini-2.0-flash-exp", "gemini-1.5-pro"],
    defaultModel: "gemini-2.0-flash-exp",
  },
} as const;

type ProviderId = keyof typeof PROVIDERS;

// Groq first, then Anthropic, then free providers
const FALLBACK_ORDER: ProviderId[] = ["groq", "anthropic", "openrouter", "openai", "gemini"];

// ── NON-ANTHROPIC PROVIDER FETCH ─────────────────────────────────────────
async function fetchSimpleProvider(
  provider: ProviderId,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  send: (event: object) => void
): Promise<void> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const chunkSize = 6;
    for (let i = 0; i < text.length; i += chunkSize) {
      send({ type: "response", content: text.slice(i, i + chunkSize) });
      await new Promise(r => setTimeout(r, 8));
    }
    send({ type: "done" });
    return;
  }

  if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const chunkSize = 6;
    for (let i = 0; i < text.length; i += chunkSize) {
      send({ type: "response", content: text.slice(i, i + chunkSize) });
      await new Promise(r => setTimeout(r, 8));
    }
    send({ type: "done" });
    return;
  }

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Jarvis Nexus",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 4096,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const chunkSize = 6;
    for (let i = 0; i < text.length; i += chunkSize) {
      send({ type: "response", content: text.slice(i, i + chunkSize) });
      await new Promise(r => setTimeout(r, 8));
    }
    send({ type: "done" });
    return;
  }

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join("") || "";
    const chunkSize = 6;
    for (let i = 0; i < text.length; i += chunkSize) {
      send({ type: "response", content: text.slice(i, i + chunkSize) });
      await new Promise(r => setTimeout(r, 8));
    }
    send({ type: "done" });
    return;
  }

  throw new Error(`Provider ${provider} not implemented`);
}

// ── ANTHROPIC AGENTIC LOOP ───────────────────────────────────────────────
async function runAnthropicLoop(
  client: Anthropic,
  model: string,
  system: string,
  messages: { role: string; content: string }[],
  send: (event: object) => void
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = [...messages];
  let loopCount = 0;
  const MAX_LOOPS = 40;

  while (loopCount < MAX_LOOPS) {
    loopCount++;

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      system,
      messages: currentMessages as Anthropic.MessageParam[],
      tools: allTools as Anthropic.Tool[],
    });

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      const textBlocks = response.content.filter(b => b.type === "text") as Anthropic.TextBlock[];
      if (textBlocks.length > 0) {
        const narration = textBlocks.map(b => b.text).join("\n\n").trim();
        if (narration) send({ type: "thinking", content: narration });
      }

      for (const toolUse of toolUseBlocks) {
        if (toolUse.name === "jarvis_plan") {
          send({
            type: "plan",
            plan: {
              task_title: (toolUse.input as Record<string, unknown>).task_title,
              steps: ((toolUse.input as Record<string, string[]>).steps || []).map((s: string) => ({ text: s, status: "pending" })),
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ planned: true, step_count: (toolUse.input as Record<string, string[]>).steps?.length }),
          });
          continue;
        }

        if (toolUse.name === "jarvis_update_step") {
          send({
            type: "plan_update",
            step_index: (toolUse.input as Record<string, number>).step_index,
            status: (toolUse.input as Record<string, string>).status,
            note: (toolUse.input as Record<string, string>).note,
          });
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify({ updated: true }) });
          continue;
        }

        send({ type: "tool_use", id: toolUse.id, name: toolUse.name, input: toolUse.input as Record<string, unknown> });

        const result = await toolExecutor(toolUse.name, toolUse.input as Record<string, unknown>);

        send({ type: "tool_result", id: toolUse.id, content: result });

        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];
    } else {
      for (const block of response.content) {
        if (block.type === "text") {
          const text = block.text;
          const chunkSize = 6;
          for (let i = 0; i < text.length; i += chunkSize) {
            send({ type: "response", content: text.slice(i, i + chunkSize) });
            await new Promise(r => setTimeout(r, 8));
          }
        }
      }
      send({ type: "done" });
      return;
    }
  }

  send({ type: "response", content: "\n\n⚠️ Limite de iterações atingido." });
  send({ type: "done" });
}

// ── FALLBACK: try every provider until one works ─────────────────────────
async function tryFallbackChain(
  skipProvider: ProviderId | null,
  system: string,
  messages: { role: string; content: string }[],
  send: (event: object) => void
): Promise<boolean> {
  for (const fb of FALLBACK_ORDER) {
    if (fb === skipProvider) continue;
    const fbKey = process.env[PROVIDERS[fb].envKey];
    if (!fbKey) continue;

    const fbModel = PROVIDERS[fb].defaultModel;
    send({ type: "thinking", content: `🔄 Tentando ${fb}/${fbModel}...` });

    try {
      if (fb === "anthropic") {
        const client = new Anthropic({ apiKey: fbKey });
        await runAnthropicLoop(client, fbModel, system, messages, send);
      } else {
        await fetchSimpleProvider(fb, fbModel, fbKey, system, messages, send);
      }
      return true;
    } catch (fbError) {
      const msg = (fbError as Error).message;
      send({ type: "thinking", content: `⚠️ ${fb} falhou: ${msg.slice(0, 80)}` });
    }
  }

  return false;
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { messages, memoryContext, provider, model } = await req.json();

  const encoder = new TextEncoder();
  const system = getSystemPrompt(memoryContext);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      try {
        // Determine provider and model — default to groq
        let selectedProvider: ProviderId = (provider as ProviderId) || "groq";
        let selectedModel: string = model || PROVIDERS[selectedProvider]?.defaultModel || "llama-3.3-70b-versatile";

        // Validate provider
        if (!PROVIDERS[selectedProvider]) {
          selectedProvider = "groq";
          selectedModel = "llama-3.3-70b-versatile";
        }

        // Check if requested provider has API key
        let apiKey = process.env[PROVIDERS[selectedProvider].envKey];

        if (!apiKey) {
          // Try fallback chain
          send({ type: "thinking", content: `⚠️ API key não configurada para ${selectedProvider}. Buscando fallback...` });
          const recovered = await tryFallbackChain(null, system, messages, send);
          if (!recovered) {
            send({ type: "error", message: "Configure uma API key nas Configurações — nenhum provider disponível." });
          }
          controller.close();
          return;
        }

        // Try the selected provider; on failure, run fallback chain
        try {
          if (selectedProvider === "anthropic") {
            const client = new Anthropic({ apiKey });
            await runAnthropicLoop(client, selectedModel, system, messages, send);
          } else {
            await fetchSimpleProvider(selectedProvider, selectedModel, apiKey, system, messages, send);
          }
        } catch (error) {
          const errMsg = (error as Error).message;
          send({ type: "thinking", content: `⚠️ ${selectedProvider} falhou: ${errMsg.slice(0, 100)}` });

          const recovered = await tryFallbackChain(selectedProvider, system, messages, send);
          if (!recovered) {
            send({ type: "error", message: `${selectedProvider} falhou e nenhum fallback disponível: ${errMsg.slice(0, 150)}` });
          }
        }
      } catch (error) {
        send({ type: "error", message: (error as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

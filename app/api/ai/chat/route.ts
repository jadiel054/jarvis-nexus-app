// app/api/ai/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { allTools } from "@/lib/tools";
import { toolExecutor } from "@/lib/agent/toolExecutor";
import { getSystemPrompt } from "@/lib/agent/systemPrompt";

export const maxDuration = 120;

// ── PROVIDER / MODEL CONFIG ──────────────────────────────────────────────
const PROVIDERS = {
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
    defaultModel: "claude-sonnet-4-6",
  },
  groq: {
    envKey: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"],
    defaultModel: "llama-3.3-70b-versatile",
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

const FALLBACK_ORDER: ProviderId[] = ["anthropic", "groq", "openrouter", "openai", "gemini"];

// ── NON-ANTHROPIC PROVIDER FETCH ─────────────────────────────────────────
async function fetchSimpleProvider(
  provider: ProviderId,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  send: (event: object) => void
): Promise<void> {
  const cfg = PROVIDERS[provider];

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
    // Stream in small chunks for visual effect
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
    // Convert messages to Gemini format
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
        // Determine provider and model
        let selectedProvider: ProviderId = (provider as ProviderId) || "anthropic";
        let selectedModel: string = model || PROVIDERS[selectedProvider]?.defaultModel || "claude-sonnet-4-6";

        // Validate provider
        if (!PROVIDERS[selectedProvider]) {
          selectedProvider = "anthropic";
          selectedModel = "claude-sonnet-4-6";
        }

        // Check if requested provider has API key
        const apiKey = process.env[PROVIDERS[selectedProvider].envKey];

        if (!apiKey) {
          // Try fallback chain
          let found = false;
          for (const fb of FALLBACK_ORDER) {
            const fbKey = process.env[PROVIDERS[fb].envKey];
            if (fbKey) {
              selectedProvider = fb;
              selectedModel = PROVIDERS[fb].defaultModel;
              found = true;
              break;
            }
          }
          if (!found) {
            send({ type: "error", message: "Configure a API key nas Configurações — nenhum provider disponível." });
            controller.close();
            return;
          }
          send({ type: "thinking", content: `⚠️ API key não configurada para ${provider}. Usando fallback: ${selectedProvider}/${selectedModel}` });
        }

        const finalApiKey = process.env[PROVIDERS[selectedProvider].envKey]!;

        // Route to Anthropic agentic loop or simple provider
        if (selectedProvider === "anthropic") {
          try {
            const client = new Anthropic({ apiKey: finalApiKey });
            await runAnthropicLoop(client, selectedModel, system, messages, send);
          } catch (error) {
            const errMsg = (error as Error).message;
            // If Anthropic fails (credits, etc.), try fallback chain
            if (errMsg.includes("credit") || errMsg.includes("429") || errMsg.includes("auth")) {
              let recovered = false;
              for (const fb of FALLBACK_ORDER) {
                if (fb === "anthropic") continue;
                const fbKey = process.env[PROVIDERS[fb].envKey];
                if (fbKey) {
                  send({ type: "thinking", content: `⚠️ Anthropic indisponível (${errMsg.slice(0, 60)}). Fallback: ${fb}/${PROVIDERS[fb].defaultModel}` });
                  try {
                    await fetchSimpleProvider(fb, PROVIDERS[fb].defaultModel, fbKey, system, messages, send);
                    recovered = true;
                    break;
                  } catch (fbError) {
                    send({ type: "thinking", content: `⚠️ ${fb} também falhou: ${(fbError as Error).message.slice(0, 60)}` });
                  }
                }
              }
              if (!recovered) {
                send({ type: "error", message: `Anthropic falhou e nenhum fallback disponível: ${errMsg}` });
              }
            } else {
              send({ type: "error", message: errMsg });
            }
          }
        } else {
          await fetchSimpleProvider(selectedProvider, selectedModel, finalApiKey, system, messages, send);
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

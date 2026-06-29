// app/api/ai/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { allTools } from "@/lib/tools";
import { toolExecutor } from "@/lib/agent/toolExecutor";
import { getSystemPrompt } from "@/lib/agent/systemPrompt";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ChatMessage = { role: "user" | "assistant"; content: string };

const PROVIDERS = {
  groq: {
    keyName: "GROQ_API_KEY",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"],
    defaultModel: "llama-3.3-70b-versatile",
  },
  openrouter: {
    keyName: "OPENROUTER_API_KEY",
    models: ["qwen/qwen3-235b-a22b:free", "deepseek/deepseek-r1:free", "google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free"],
    defaultModel: "google/gemini-2.0-flash-exp:free",
  },
  gemini: {
    keyName: "GEMINI_API_KEY",
    models: ["gemini-2.0-flash-exp", "gemini-1.5-pro"],
    defaultModel: "gemini-2.0-flash-exp",
  },
  anthropic: {
    keyName: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
    defaultModel: "claude-sonnet-4-6",
  },
  openai: {
    keyName: "OPENAI_API_KEY",
    models: ["gpt-4o", "gpt-4o-mini"],
    defaultModel: "gpt-4o-mini",
  },
  deepseek: {
    keyName: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat"],
    defaultModel: "deepseek-chat",
  },
} as const;

type ProviderId = keyof typeof PROVIDERS;

const FALLBACK_ORDER: ProviderId[] = ["groq", "openrouter", "gemini", "anthropic"];

function decryptSettingValue(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("enc:")) return value;

  try {
    return Buffer.from(value.slice(4), "base64").toString("utf8");
  } catch {
    return value;
  }
}

async function getConfigFromSettings(): Promise<Record<string, string>> {
  const config: Record<string, string> = {};

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await admin.from("settings").select("key, value");

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row?.key && typeof row.value === "string") {
          config[row.key] = decryptSettingValue(row.value);
        }
      }
    }
  } catch (error) {
    console.warn("Falha ao ler settings do Supabase:", (error as Error).message);
  }

  for (const provider of Object.values(PROVIDERS)) {
    const envValue = process.env[provider.keyName];
    if (!config[provider.keyName] && envValue) {
      config[provider.keyName] = envValue;
    }
  }

  return config;
}

function resolveProvider(provider: unknown): ProviderId {
  if (typeof provider === "string" && provider in PROVIDERS) {
    return provider as ProviderId;
  }
  return "groq";
}

function resolveModel(provider: ProviderId, requestedModel: unknown): string {
  if (typeof requestedModel === "string" && PROVIDERS[provider].models.includes(requestedModel as never)) {
    return requestedModel;
  }
  return PROVIDERS[provider].defaultModel;
}

async function fetchOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  extraHeaders?: Record<string, string>
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(extraHeaders || {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${url} ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function fetchSimpleProvider(
  provider: Exclude<ProviderId, "anthropic">,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  send: (event: object) => void
): Promise<void> {
  let text = "";

  if (provider === "groq") {
    text = await fetchOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", apiKey, model, systemPrompt, messages);
  } else if (provider === "openai") {
    text = await fetchOpenAICompatible("https://api.openai.com/v1/chat/completions", apiKey, model, systemPrompt, messages);
  } else if (provider === "deepseek") {
    text = await fetchOpenAICompatible("https://api.deepseek.com/v1/chat/completions", apiKey, model, systemPrompt, messages);
  } else if (provider === "openrouter") {
    text = await fetchOpenAICompatible(
      "https://openrouter.ai/api/v1/chat/completions",
      apiKey,
      model,
      systemPrompt,
      messages,
      {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Jarvis Nexus",
      }
    );
  } else if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: { maxOutputTokens: 4096 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
  }

  const chunkSize = 6;
  for (let index = 0; index < text.length; index += chunkSize) {
    send({ type: "response", content: text.slice(index, index + chunkSize) });
    await new Promise((resolve) => setTimeout(resolve, 8));
  }

  send({ type: "done" });
}

async function runAnthropicLoop(
  client: Anthropic,
  model: string,
  system: string,
  messages: ChatMessage[],
  send: (event: object) => void
): Promise<void> {
  let currentMessages: Anthropic.MessageParam[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  let loopCount = 0;
  const maxLoops = 40;

  while (loopCount < maxLoops) {
    loopCount += 1;

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      system,
      messages: currentMessages,
      tools: allTools as Anthropic.Tool[],
    });

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use") as Anthropic.ToolUseBlock[];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      const narration = response.content
        .filter((block) => block.type === "text")
        .map((block) => ("text" in block ? block.text : ""))
        .join("\n\n")
        .trim();

      if (narration) {
        send({ type: "thinking", content: narration });
      }

      for (const toolUse of toolUseBlocks) {
        const input = toolUse.input as Record<string, unknown>;

        if (toolUse.name === "jarvis_plan") {
          const steps = Array.isArray(input.steps) ? input.steps.map((step) => ({ text: String(step), status: "pending" })) : [];
          send({
            type: "plan",
            plan: {
              task_title: String(input.task_title || "Plano"),
              steps,
            },
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ planned: true, step_count: steps.length }),
          });
          continue;
        }

        if (toolUse.name === "jarvis_update_step") {
          send({
            type: "plan_update",
            step_index: Number(input.step_index),
            status: input.status,
            note: typeof input.note === "string" ? input.note : undefined,
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ updated: true }),
          });
          continue;
        }

        send({ type: "tool_use", id: toolUse.id, name: toolUse.name, input });

        const result = await toolExecutor(toolUse.name, input);

        send({ type: "tool_result", id: toolUse.id, content: result });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
      continue;
    }

    for (const block of response.content) {
      if (block.type !== "text") continue;

      const chunkSize = 6;
      for (let index = 0; index < block.text.length; index += chunkSize) {
        send({ type: "response", content: block.text.slice(index, index + chunkSize) });
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
    }

    send({ type: "done" });
    return;
  }

  send({ type: "response", content: "\n\n⚠️ Limite de iterações atingido." });
  send({ type: "done" });
}

async function tryFallbackChain(
  config: Record<string, string>,
  skipProvider: ProviderId | null,
  system: string,
  messages: ChatMessage[],
  send: (event: object) => void
): Promise<boolean> {
  for (const provider of FALLBACK_ORDER) {
    if (provider === skipProvider) continue;

    const apiKey = config[PROVIDERS[provider].keyName];
    if (!apiKey) continue;

    const model = PROVIDERS[provider].defaultModel;
    send({ type: "thinking", content: `🔄 Tentando ${provider}/${model}...` });

    try {
      if (provider === "anthropic") {
        const client = new Anthropic({ apiKey });
        await runAnthropicLoop(client, model, system, messages, send);
      } else {
        await fetchSimpleProvider(provider, model, apiKey, system, messages, send);
      }
      return true;
    } catch (error) {
      send({ type: "thinking", content: `⚠️ ${provider} falhou: ${(error as Error).message.slice(0, 80)}` });
    }
  }

  return false;
}

export async function POST(req: NextRequest) {
  const { messages, memoryContext, provider, model } = await req.json();

  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Messages array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const safeMessages: ChatMessage[] = messages.filter(
    (message: unknown): message is ChatMessage =>
      Boolean(
        message &&
          typeof message === "object" &&
          "role" in message &&
          "content" in message &&
          ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant") &&
          typeof (message as ChatMessage).content === "string"
      )
  );

  const config = await getConfigFromSettings();
  const selectedProvider = resolveProvider(provider);
  const selectedModel = resolveModel(selectedProvider, model);
  const system = getSystemPrompt(typeof memoryContext === "string" ? memoryContext : "");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      try {
        const apiKey = config[PROVIDERS[selectedProvider].keyName];

        if (!apiKey) {
          send({ type: "thinking", content: `⚠️ API key não configurada para ${selectedProvider}. Buscando fallback...` });
          const recovered = await tryFallbackChain(config, null, system, safeMessages, send);
          if (!recovered) {
            send({ type: "error", message: "Configure uma API key nas Configurações. Nenhum provider disponível." });
          }
          return;
        }

        try {
          if (selectedProvider === "anthropic") {
            const client = new Anthropic({ apiKey });
            await runAnthropicLoop(client, selectedModel, system, safeMessages, send);
          } else {
            await fetchSimpleProvider(selectedProvider, selectedModel, apiKey, system, safeMessages, send);
          }
        } catch (error) {
          const message = (error as Error).message;
          send({ type: "thinking", content: `⚠️ ${selectedProvider} falhou: ${message.slice(0, 100)}` });

          const recovered = await tryFallbackChain(config, selectedProvider, system, safeMessages, send);
          if (!recovered) {
            send({ type: "error", message: `${selectedProvider} falhou e nenhum fallback disponível: ${message.slice(0, 150)}` });
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
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

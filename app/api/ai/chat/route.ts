// app/api/ai/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { allTools } from "@/lib/tools";
import { toolExecutor } from "@/lib/agent/toolExecutor";
import { getSystemPrompt } from "@/lib/agent/systemPrompt";
import { AI_PROVIDERS, FALLBACK_ORDER, type ProviderId } from "@/lib/ai/providers";
import { requireAuth, type AuthResult } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ChatMessage = { role: "user" | "assistant"; content: string };

function decryptSettingValue(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("enc:")) return value;

  try {
    return Buffer.from(value.slice(4), "base64").toString("utf8");
  } catch {
    return value;
  }
}

function truncateResult(toolName: string, result: unknown): string {
  const maxLen = toolName === "github_read_file" ? 40000 : 12000;
  const originalJson = typeof result === "string" ? result : JSON.stringify(result ?? null);
  const originalLength = originalJson.length;

  if (originalLength <= maxLen) {
    return originalJson;
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    if (toolName === "github_read_file" && typeof obj.content === "string") {
      const truncatedContent = obj.content.slice(0, maxLen - 500) + "\n...[conteúdo truncado]";
      return JSON.stringify({
        ...obj,
        content: truncatedContent,
        truncated: true,
        original_length: originalLength,
      });
    }

    return JSON.stringify({
      ...obj,
      truncated: true,
      original_length: originalLength,
    });
  }

  if (Array.isArray(result)) {
    return JSON.stringify({
      results: result.slice(0, 15),
      truncated: true,
      original_length: originalLength,
    });
  }

  return JSON.stringify({
    content: String(result).slice(0, maxLen - 200) + "...[truncado]",
    truncated: true,
    original_length: originalLength,
  });
}

function formatResultForBrowser(result: unknown): unknown {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const obj = { ...(result as Record<string, unknown>) };
    if ("content" in obj) {
      const rawContent = obj.content;
      const contentLength = typeof rawContent === "string" ? rawContent.length : (rawContent ? String(rawContent).length : 0);
      delete obj.content;
      obj.content_length = contentLength;
    }

    const jsonStr = JSON.stringify(obj);
    if (jsonStr.length > 2000) {
      return {
        ...obj,
        _preview: jsonStr.slice(0, 1800) + "...[truncado]",
        truncated: true,
      };
    }
    return obj;
  }

  if (Array.isArray(result)) {
    const jsonStr = JSON.stringify(result);
    if (jsonStr.length > 2000) {
      return {
        total_items: result.length,
        items_preview: result.slice(0, 5),
        truncated: true,
      };
    }
    return result;
  }

  if (typeof result === "string") {
    if (result.length > 2000) {
      return {
        text_preview: result.slice(0, 1800) + "...[truncado]",
        original_length: result.length,
        truncated: true,
      };
    }
    return result;
  }

  return result;
}

async function getConfigFromSettings(auth: AuthResult & { authorized: true }): Promise<Record<string, string>> {
  const config: Record<string, string> = {};

  let ownerId: string | null = null;
  if (auth.user) {
    ownerId = auth.user.id;
  } else if (auth.isInternal && process.env.OWNER_USER_ID) {
    ownerId = process.env.OWNER_USER_ID;
  }

  if (ownerId) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data, error } = await admin
        .from("settings")
        .select("key, value")
        .eq("user_id", ownerId);

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
  }

  for (const provider of Object.values(AI_PROVIDERS)) {
    const envValue = process.env[provider.envKey];
    if (!config[provider.envKey] && envValue) {
      config[provider.envKey] = envValue;
    }
  }

  return config;
}

function resolveProvider(provider: unknown): ProviderId {
  if (typeof provider === "string" && provider in AI_PROVIDERS) {
    return provider as ProviderId;
  }
  return "groq";
}

function resolveModel(provider: ProviderId, requestedModel: unknown): string {
  if (typeof requestedModel === "string" && AI_PROVIDERS[provider].models.includes(requestedModel as never)) {
    return requestedModel;
  }
  return AI_PROVIDERS[provider].defaultModel;
}

async function fetchOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  extraHeaders?: Record<string, string>,
  opts?: { reasoningModel?: boolean }
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  };

  if (opts?.reasoningModel) {
    body.max_completion_tokens = 8192;
  } else {
    body.max_tokens = 4096;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${baseUrl} ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content : "";
  const reasoning = typeof message?.reasoning === "string" ? message.reasoning : "";
  const text = (content || reasoning).trim();

  if (!text) {
    throw new Error(`${baseUrl}: resposta vazia (reasoning exauriu o orçamento de tokens)`);
  }

  return text;
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

  if (provider === "openrouter") {
    text = await fetchOpenAICompatible(
      AI_PROVIDERS.openrouter.baseUrl,
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
  } else if (provider === "groq") {
    text = await fetchOpenAICompatible(AI_PROVIDERS.groq.baseUrl, apiKey, model, systemPrompt, messages);
  } else if (provider === "cerebras") {
    text = await fetchOpenAICompatible(
      AI_PROVIDERS.cerebras.baseUrl,
      apiKey,
      model,
      systemPrompt,
      messages,
      undefined,
      { reasoningModel: AI_PROVIDERS.cerebras.reasoning }
    );
  } else if (provider === "openai") {
    text = await fetchOpenAICompatible(AI_PROVIDERS.openai.baseUrl, apiKey, model, systemPrompt, messages);
  } else if (provider === "deepseek") {
    text = await fetchOpenAICompatible(AI_PROVIDERS.deepseek.baseUrl, apiKey, model, systemPrompt, messages);
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

        const rawResult = await toolExecutor(toolUse.name, input);

        const browserResult = formatResultForBrowser(rawResult);
        send({ type: "tool_result", id: toolUse.id, content: browserResult });

        const modelResult = truncateResult(toolUse.name, rawResult);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: modelResult,
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

    const apiKey = config[AI_PROVIDERS[provider].envKey];
    if (!apiKey) continue;

    const model = AI_PROVIDERS[provider].defaultModel;
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
  const auth = await requireAuth(req);
  if (!auth.authorized) {
    return auth.response;
  }

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

  const config = await getConfigFromSettings(auth);
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
        const apiKey = config[AI_PROVIDERS[selectedProvider].envKey];

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

// app/api/ai/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { allTools } from "@/lib/tools";
import { supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/config";
import { chatMemory } from "@/lib/memory";

export dynamic = "force-dynamic";

// Provider fallback order — Groq first since it's free and reliable
const FALLBACK_ORDER = ["groq", "openrouter", "gemini", "deepseek", "openai", "anthropic"];

function getProviderConfig(key: string) {
  const providers = {
    anthropic: {
      name: "Anthropic (Haiku, Opus, Sonnet)",
      model: "claude-sonnet-4-20250501",
      keyName: "ANTHROPIC_API_KEY",
    },
    openai: {
      name: "OpenAI (GPT-4o, GPT-4.5)",
      model: "gpt-4.1-nano",
      keyName: "OPENAI_API_KEY",
    },
    groq: {
      name: "Groq (Llama 3.3, 70B - Versatile)",
      model: "llama-3.3-70b-versatile",
      keyName: "GROQ_API_KEY",
    },
    gemini: {
      name: "Google Gemini 2.5 Flash",
      model: "gemini-2.5-flash-preview-05-20",
      keyName: "GEMINI_API_KEY",
    },
    deepseek: {
      name: "DeepSeek",
      model: "deepseek-chat",
      keyName: "DEEPSEEK_API_KEY",
    },
    openrouter: {
      name: "OpenRouter",
      model: "openrouter/optimus-alpha",
      keyName: "OPENROUTER_API_KEY",
    },
  };
  return providers[key] || null;
}

function getFirstAvailableKey(config: Record<string, string>): { providerKey: string; apiKey: string } | null {
  for (const providerKey of FALLBACK_ORDER) {
    const provider = getProviderConfig(providerKey);
    if (!provider) continue;
    const apiKey = config[provider.keyName];
    if (apiKey) {
      return { providerKey, apiKey };
    }
  }
  return null;
}

// Generic streaming chat completion for any provider
async function callProvider(providerKey: string, apiKey: string, model: string, messages: any[], tools: any[]) {
  const body: any = {
    model,
    messages,
    stream: true,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  let url: string;
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  switch (providerKey) {
    case "anthropic":
      url = "https://api.anthropic.com/v1/messages";
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      // Anthropic requires max_tokens
      body.max_tokens = 4096;
      break;

    case "openai":
      url = "https://api.openai.com/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;

    case "groq":
      url = "https://api.groq.com/open/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;

    case "gemini":
      // Gemini uses different streaming format, handled separately
      break;

    case "deepseek":
      url = "https://api.deepseek.com/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;

    case "openrouter":
      url = "https://openrouter.ai/api/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["HTTP-Referer"] = "https://jarvis-nexus.app";
      headers["X-Title"] = "Jarvis Nexus";
      break;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${providerKey} API error (${response.status}): ${errorText}`);
  }

  return response;
}

// Gemini streaming handler - uses different SSE format
async function callGemini(apiKey: string, model: string, messages: any[], tools: any[]) {
  // Convert to Gemini format
  const contents = messages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=key${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  return response;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, model: requestedModel, systemPrompt } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NewtResponse(JSON.stringify({ error: "Messages array required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get settings from Supabase
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("key, value");

    if (settingsError) {
      console.error("Settings fetch error:", settingsError);
    }

    // Convert settings array to object
    const config: Record<string, string> = {};
    if (settings) {
      for (const s of settings) {
        config[s.key] = s.value;
      }
    }

    // Get memory context
    const memoryContext = await chatMemory.getContext();

    // Determine which provider to use
    let providerKey: string;
    let apiKey: string;
    let model: string;

    if (requestedModel) {
      // User specified a model - find its provider
      for (const [key, provider] of Object.entries(providers)) {
        if (provider.model === requestedModel) {
          providerKey = key;
          model = requestedModel;
          break;
        }
      }
      if (!providerKey) {
        // Model not found in our config, try as OpenAI compatible
        providerKey = "openrouter";
        model = requestedModel;
      }
      // Get API key for this provider
      const provider = getProviderConfig(providerKey);
      if (provider) {
        apiKey = config[provider.keyName];
      }
    } else {
      // Auto-select first available provider
      const selected = getFirstAvailableKey(config);
      if (!selected) {
        return NewtResponse(JSON.stringify({ error: "No API key configured. Add a key in Settings." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      providerKey = selected.providerKey;
      apiKey = selected.apiKey;
      model = getProviderConfig(providerKey)?.model || "";
    }

    if (!apiKey) {
      return NewtResponse(JSON.stringify({ error: `API key not found for ${providerKey} provider` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Using provider: ${providerKey}, model: ${model}`);

    // Prepare messages with memory and system prompt
    const fullMessages = [...memoryContext, ...messages];

    if (systemPrompt) {
      fullMessages.unshift({ role: "system", content: systemPrompt });
    }

    // Call the provider
    let response: Response;

    if (providerKey === "gemini") {
      response = await callGemini(apiKey, model, fullMessages, allTools);
    } else {
      response = await callProvider(providerKey, apiKey, model, fullMessages, allTools);
    }

    // Stream back to client
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NewtResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

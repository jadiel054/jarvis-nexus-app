// app/api/telegram/webhook/comando/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function validateTelegramSecret(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  const token = req.headers.get("x-telegram-bot-api-secret-token");
  if (!token) return false;
  const bufA = Buffer.from(token);
  const bufB = Buffer.from(secret);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  if (!validateTelegramSecret(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const message = body?.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text as string;
  const userId = message.from?.id;

  // Only Jadiel can use
  const allowed = [parseInt(process.env.TELEGRAM_ADMIN_CHAT_ID || "0")];
  if (!allowed.includes(userId)) return NextResponse.json({ ok: true });

  const token = process.env.TELEGRAM_BOT_COMANDO_TOKEN!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Send "thinking" indicator
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });

  try {
    const chatHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.INTERNAL_API_SECRET) {
      chatHeaders["x-internal-secret"] = process.env.INTERNAL_API_SECRET;
    }

    // Call Jarvis chat endpoint
    const chatRes = await fetch(`${appUrl}/api/ai/chat`, {
      method: "POST",
      headers: chatHeaders,
      body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
    });

    if (!chatRes.ok || !chatRes.body) throw new Error("Chat endpoint falhou");

    // Consume SSE stream and collect final response
    const reader = chatRes.body.getReader();
    const decoder = new TextDecoder();
    let finalText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "response") finalText += event.content || "";
        } catch {}
      }
    }

    if (!finalText) finalText = "Processado. Sem resposta de texto.";

    // Send response back via Telegram (Markdown, split if > 4096 chars)
    const chunks = finalText.match(/[\s\S]{1,4000}/g) || [finalText];
    for (const chunk of chunks) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }),
      });
    }
  } catch (err) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `❌ Erro: ${(err as Error).message}` }),
    });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message = body?.message;
  if (!message?.text) return NextResponse.json({ ok: true });
  const chatId = message.chat.id;
  const text = message.text as string;
  const userId = message.from?.id;
  const allowed = [parseInt(process.env.TELEGRAM_ADMIN_CHAT_ID || "0")];
  if (!allowed.includes(userId)) return NextResponse.json({ ok: true });

  const token = process.env.TELEGRAM_BOT_ALERTS_TOKEN!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });

  try {
    const chatRes = await fetch(`${appUrl}/api/ai/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
    });
    if (!chatRes.ok || !chatRes.body) throw new Error("Chat falhou");
    const reader = chatRes.body.getReader();
    const decoder = new TextDecoder();
    let finalText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try { const ev = JSON.parse(line.slice(6)); if (ev.type === "response") finalText += ev.content; } catch {}
      }
    }
    const chunks = (finalText || "Processado.").match(/.{1,4000}/gs) || [finalText];
    for (const chunk of chunks) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "Markdown" }),
      });
    }
  } catch (err) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `❌ ${(err as Error).message}` }),
    });
  }
  return NextResponse.json({ ok: true });
}

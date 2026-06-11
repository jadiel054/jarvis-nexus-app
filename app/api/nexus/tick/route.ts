// app/api/nexus/tick/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const results: string[] = [];

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: true, results: ["Supabase não configurado"], timestamp: new Date().toISOString() });
  }

  const headers = {
    "Content-Type": "application/json",
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
  };

  try {
    // 1. Check unprocessed Zarith messages
    const zarithR = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_messages?from_agent=eq.zarith&processed_at=is.null&order=created_at.asc&limit=5`,
      { headers }
    );
    if (zarithR.ok) {
      const msgs = await zarithR.json();
      for (const msg of msgs || []) {
        // Send Telegram notification about Zarith response
        const tgToken = process.env.TELEGRAM_BOT_ALERTS_TOKEN;
        const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
        if (tgToken && chatId) {
          await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: `⚡ *Zarith concluiu uma tarefa*\n\n${msg.content?.slice(0,300)}`, parse_mode: "Markdown" }),
          });
        }
        // Mark as processed
        await fetch(`${SUPABASE_URL}/rest/v1/agent_messages?id=eq.${msg.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ processed_at: new Date().toISOString() }),
        });
        results.push(`Zarith message processed: ${msg.id}`);
      }
    }

    // 2. Log tick
    await fetch(`${SUPABASE_URL}/rest/v1/agent_logs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action_type: "autonomous_tick", success: true, output: { results }, created_at: new Date().toISOString() }),
    });

  } catch (err) {
    results.push(`Error: ${(err as Error).message}`);
  }

  return NextResponse.json({ ok: true, results, timestamp: new Date().toISOString() });
}

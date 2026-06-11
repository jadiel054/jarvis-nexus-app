// app/api/supabase/zarith/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { task, context, repo, priority = "normal" } = await req.json();

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      from_agent: "jarvis",
      to_agent: "zarith",
      type: "task",
      content: task,
      metadata: { context, repo, priority },
      created_at: new Date().toISOString(),
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    if (err.includes("does not exist")) {
      return NextResponse.json({ id: `queued_${Date.now()}`, queued: true, note: "Zarith: Supabase não configurado ainda." });
    }
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const data = await r.json();
  return NextResponse.json({ id: data[0]?.id, queued: true, note: "Tarefa enviada para a Zarith via Supabase Realtime." });
}

// app/api/agent/task/route.ts
// Endpoint para Workers receberem tarefas do Jarvis via protocolo v1.0
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { protocol_version, task_id, from, to, task } = body;

  if (!protocol_version || !task_id || !from || !to || !task) {
    return NextResponse.json(
      { error: "Payload inválido — campos obrigatórios: protocol_version, task_id, from, to, task" },
      { status: 400 }
    );
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!SUPABASE_URL || !SERVICE_KEY)
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/agent_messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      from_agent: from,
      to_agent: to,
      type: "task",
      content: task.description,
      metadata: {
        protocol_version,
        task_id,
        task_type: task.type,
        priority: task.priority || "normal",
        context: task.context || {},
        requires_confirmation: task.requires_confirmation || false,
        deadline: task.deadline || null,
      },
      created_at: new Date().toISOString(),
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    return NextResponse.json(
      { error: `Falha ao enfileirar tarefa: ${err.slice(0, 200)}` },
      { status: 500 }
    );
  }

  const data = await r.json();
  return NextResponse.json({
    protocol_version: "1.0",
    task_id,
    message_id: data[0]?.id,
    status: "queued",
    queued_at: new Date().toISOString(),
  });
}

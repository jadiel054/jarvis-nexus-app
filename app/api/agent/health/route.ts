// app/api/agent/health/route.ts
import { NextRequest, NextResponse } from "next/server";

// GET — Jarvis consulta saúde de um agente
export async function GET(req: NextRequest) {
  const agentName = req.nextUrl.searchParams.get("agent");
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!SUPABASE_URL || !SERVICE_KEY)
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });

  const headers = {
    "Content-Type": "application/json",
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };

  let query = `${SUPABASE_URL}/rest/v1/agent_health_logs?order=logged_at.desc&limit=1`;
  if (agentName) query += `&agent_name=eq.${agentName}`;

  const r = await fetch(query, { headers });
  if (!r.ok) return NextResponse.json({ error: "Falha ao buscar health" }, { status: 500 });

  const rows = await r.json();
  if (!rows?.length)
    return NextResponse.json({ status: "unknown", note: "Sem heartbeat registrado ainda" });

  const last = rows[0];
  const secondsSince = (Date.now() - new Date(last.logged_at).getTime()) / 1000;
  const isStale = secondsSince > 120; // 2 min sem heartbeat = degraded

  return NextResponse.json({
    agent: last.agent_name,
    status: isStale ? "degraded" : last.status,
    last_seen: last.logged_at,
    seconds_since_heartbeat: Math.round(secondsSince),
    queue_size: last.queue_size,
    current_task: last.current_task,
    last_error: last.last_error,
  });
}

// POST — Agente registra seu heartbeat
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    agent,
    status = "healthy",
    queue_size = 0,
    current_task = null,
    last_error = null,
    uptime_ms = 0,
  } = body;

  if (!agent)
    return NextResponse.json({ error: "Campo 'agent' obrigatório" }, { status: 400 });

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = {
    "Content-Type": "application/json",
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };

  await fetch(`${SUPABASE_URL}/rest/v1/agent_health_logs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      agent_name: agent,
      status,
      queue_size,
      current_task,
      last_error,
      uptime_ms,
      logged_at: new Date().toISOString(),
    }),
  });

  await fetch(`${SUPABASE_URL}/rest/v1/agent_registry?agent_name=eq.${agent}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      status: status === "healthy" ? "online" : status,
      last_seen: new Date().toISOString(),
    }),
  });

  return NextResponse.json({ ok: true, agent, logged_at: new Date().toISOString() });
}

// app/api/supabase/memory/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, content, category, project, query, limit = 8 } = body;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const OPENAI_KEY   = process.env.OPENAI_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
  };

  if (action === "save") {
    // Try to generate embedding with OpenAI
    let embedding: number[] | null = null;
    if (OPENAI_KEY) {
      try {
        const embR = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: "text-embedding-3-small", input: content }),
        });
        if (embR.ok) {
          const embData = await embR.json();
          embedding = embData.data?.[0]?.embedding;
        }
      } catch {}
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content,
        category,
        project: project || null,
        embedding: embedding ? JSON.stringify(embedding) : null,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
        access_count: 1,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      // If memories table doesn't exist yet, return graceful fallback
      if (err.includes("does not exist")) {
        return NextResponse.json({ id: `local_${Date.now()}`, saved: true, note: "Salvo localmente (Supabase não configurado)" });
      }
      return NextResponse.json({ error: err }, { status: 500 });
    }

    return NextResponse.json({ saved: true });
  }

  if (action === "search") {
    // Try vector search first, fall back to text search
    let results = [];

    if (OPENAI_KEY) {
      try {
        const embR = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: "text-embedding-3-small", input: query }),
        });
        if (embR.ok) {
          const embData = await embR.json();
          const embedding = embData.data?.[0]?.embedding;

          const vecR = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_memories`, {
            method: "POST",
            headers,
            body: JSON.stringify({ query_embedding: embedding, match_count: limit, similarity_threshold: 0.6 }),
          });
          if (vecR.ok) results = await vecR.json();
        }
      } catch {}
    }

    // Fallback: simple text search
    if (results.length === 0) {
      const textR = await fetch(
        `${SUPABASE_URL}/rest/v1/memories?content=ilike.*${encodeURIComponent(query.slice(0,30))}*&limit=${limit}&order=accessed_at.desc`,
        { headers }
      );
      if (textR.ok) results = await textR.json();
    }

    return NextResponse.json({
      _knowledge: true,
      query,
      results: (results || []).map((r: Record<string,unknown>) => ({
        id: r.id,
        content: r.content,
        category: r.category,
        project: r.project,
        created_at: r.created_at,
        score: r.similarity || 1,
      })),
      total: results?.length || 0,
      found: (results?.length || 0) > 0,
    });
  }

  return NextResponse.json({ error: "Action inválida" }, { status: 400 });
}

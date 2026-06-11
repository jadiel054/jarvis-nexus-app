-- ═══════════════════════════════════════════════════════════════
-- JARVIS NEXUS — Supabase Schema
-- Project: vftnxjoijdniohnglldu
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── CONVERSATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT DEFAULT 'Nova conversa',
  pinned     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MESSAGES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT CHECK (role IN ('user','assistant','system','tool')),
  content         TEXT NOT NULL,
  tool_calls      JSONB,
  tool_results    JSONB,
  model           TEXT,
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEMORIES (with pgvector) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS memories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  embedding    VECTOR(1536),
  category     TEXT CHECK (category IN ('preference','decision','credential','context','todo','project')),
  project      TEXT,
  tags         TEXT[],
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  accessed_at  TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS memories_embedding_idx
ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ── AGENT MESSAGES (Jarvis ↔ Zarith) ─────────────────────────
CREATE TABLE IF NOT EXISTS agent_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent   TEXT CHECK (from_agent IN ('jarvis','zarith','system')),
  to_agent     TEXT CHECK (to_agent IN ('jarvis','zarith','system')),
  type         TEXT CHECK (type IN ('task','result','status','error','ping')),
  content      TEXT NOT NULL,
  metadata     JSONB,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for agent_messages
ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;

-- ── AGENT LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type   TEXT,
  tool_name     TEXT,
  input         JSONB,
  output        JSONB,
  success       BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── USER SETTINGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  telegram_chat_id   TEXT,
  active_model       TEXT DEFAULT 'claude-sonnet-4-6',
  autonomous_mode    BOOLEAN DEFAULT TRUE,
  notification_level TEXT DEFAULT 'normal',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own messages" ON messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own memories" ON memories
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- ── VECTOR SEARCH FUNCTION ────────────────────────────────────
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding VECTOR(1536),
  match_count     INTEGER DEFAULT 8,
  similarity_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id           UUID,
  content      TEXT,
  category     TEXT,
  project      TEXT,
  created_at   TIMESTAMPTZ,
  similarity   FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.category,
    m.project,
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE 1 - (m.embedding <=> query_embedding) > similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

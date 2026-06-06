/**
 * database_oracle — Memória de longo prazo via Supabase (Zarith-SaaS).
 * Tabelas: system_status, agent_sessions
 * Fallback: UserSettings entity quando Supabase indisponível.
 */
import { supabase } from '@/lib/supabaseClient';

// ── system_status (chave-valor) ───────────────────────────────────────

export async function oracleRead(key) {
  try {
    const rows = await supabase.select('system_status', `key=eq.${encodeURIComponent(key)}&select=key,value,updated_at`);
    if (rows?.length > 0) {
      return { found: true, key, value: rows[0].value, updatedAt: rows[0].updated_at };
    }
    return { found: false, key, value: null };
  } catch (e) {
    return await _fallbackRead(key, e.message);
  }
}

export async function oracleWrite(key, value) {
  const strVal = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    await supabase.upsert('system_status', {
      key,
      value: strVal,
      updated_at: new Date().toISOString(),
    });
    return { success: true, key, value: strVal };
  } catch (e) {
    return await _fallbackWrite(key, strVal, e.message);
  }
}

export async function oracleReadAll() {
  try {
    const rows = await supabase.select('system_status', 'select=key,value,updated_at&order=updated_at.desc&limit=50');
    return { success: true, rows: rows || [] };
  } catch (e) {
    return { success: false, error: e.message, rows: [] };
  }
}

export async function oracleDelete(key) {
  try {
    await supabase.remove('system_status', `key=eq.${encodeURIComponent(key)}`);
    return { success: true, key };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── agent_sessions ────────────────────────────────────────────────────

/** Registra uma sessão de agente */
export async function logAgentSession(agentName, action, metadata = {}) {
  try {
    await supabase.upsert('agent_sessions', {
      agent_name: agentName,
      action,
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString(),
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/** Lista as últimas sessões de agente */
export async function getAgentSessions(limit = 10) {
  try {
    const rows = await supabase.select('agent_sessions', `select=agent_name,action,metadata,created_at&order=created_at.desc&limit=${limit}`);
    return { success: true, sessions: rows || [] };
  } catch (e) {
    return { success: false, error: e.message, sessions: [] };
  }
}

// ── Fallbacks (UserSettings entity) ──────────────────────────────────

async function _fallbackRead(key, originalError) {
  try {
    const { base44 } = await import('@/api/base44Client');
    const user = await base44.auth.me();
    const records = await base44.entities.UserSettings.filter({ user_email: user.email });
    if (records.length > 0) {
      const fact = records[0].memory_facts?.find(f => f.key === key);
      if (fact) return { found: true, key, value: fact.value, source: 'userSettings' };
    }
    return { found: false, key, value: null, warning: `Supabase: ${originalError}` };
  } catch (e) {
    console.warn('[Oracle] Fallback read also failed:', e.message);
    return { found: false, key, value: null, error: originalError };
  }
}

async function _fallbackWrite(key, value, originalError) {
  try {
    const { base44 } = await import('@/api/base44Client');
    const user = await base44.auth.me();
    const records = await base44.entities.UserSettings.filter({ user_email: user.email });
    if (records.length > 0) {
      const existing = records[0];
      const facts = (existing.memory_facts || []).filter(f => f.key !== key);
      facts.push({ key, value, updated_at: new Date().toISOString() });
      await base44.entities.UserSettings.update(existing.id, { memory_facts: facts.slice(-100) });
    } else {
      await base44.entities.UserSettings.create({
        user_email: user.email,
        user_name: user.full_name || 'Jadiel',
        memory_facts: [{ key, value, updated_at: new Date().toISOString() }],
      });
    }
    return { success: true, key, value, source: 'userSettings', warning: `Supabase: ${originalError}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;
  const i = JSON.parse(localStorage.getItem('jarvis_integrations') || '{}');
  const url = i.supabase?.url;
  const key = i.supabase?.anon_key;
  if (url && key) _client = createClient(url, key);
  return _client;
}

export function resetClient() { _client = null; }

export async function testConnection() {
  const i = JSON.parse(localStorage.getItem('jarvis_integrations') || '{}');
  const url = i.supabase?.url;
  const key = i.supabase?.anon_key;
  if (!url || !key) return { ok: false, configured: false };
  try {
    const sb = createClient(url, key);
    const { data, error } = await sb.from('agent_sessions').select('id').limit(3);
    if (error) return { ok: false, configured: true, error: error.message };
    return { ok: true, configured: true, rows: data || [] };
  } catch(e) {
    return { ok: false, configured: true, error: e.message };
  }
}

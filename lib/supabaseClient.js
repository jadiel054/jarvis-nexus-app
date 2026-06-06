import { createClient } from '@supabase/supabase-js';
import { loadIntegrations } from '@/utils/secureStorage';

let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;
  const i = loadIntegrations();
  const url = i.supabase?.url;
  const key = i.supabase?.anon_key;
  if (url && key) _client = createClient(url, key);
  return _client;
}

// Export direto que o databaseOracle espera
export const supabase = {
  from: (table) => {
    const sb = getSupabaseClient();
    if (!sb) return { select: () => ({ eq: () => ({ data: null, error: { message: 'Supabase não configurado' } }) }) };
    return sb.from(table);
  },
  rpc: (...args) => {
    const sb = getSupabaseClient();
    if (!sb) return { data: null, error: { message: 'Supabase não configurado' } };
    return sb.rpc(...args);
  },
};

export function resetClient() { _client = null; }

export async function testConnection() {
  const i = loadIntegrations();
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

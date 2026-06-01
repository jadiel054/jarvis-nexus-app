/**
 * Supabase client centralizado para o projeto Zarith-SaaS.
 * As credenciais são lidas do localStorage (configuradas via Integrações no SettingsPanel).
 */

function getConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem('jarvis_integrations') || '{}');
    return {
      url: stored.supabase?.url || null,
      key: stored.supabase?.anon_key || null,
    };
  } catch { return { url: null, key: null }; }
}

export function isConfigured() {
  const { url, key } = getConfig();
  return !!(url && key);
}

async function query(path, options = {}) {
  const { url, key } = getConfig();
  if (!url || !key) throw new Error('Supabase não configurado. Acesse Configurações → Integrações.');

  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase [${res.status}]: ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Testa a conexão lendo a tabela agent_sessions */
export async function testConnection() {
  if (!isConfigured()) return { ok: false, error: 'Supabase não configurado.', configured: false };
  try {
    const rows = await query('agent_sessions?select=id,created_at&limit=5');
    return { ok: true, rows: rows || [], configured: true };
  } catch (e) {
    return { ok: false, error: e.message, configured: true };
  }
}

export async function select(table, queryString = '') {
  const path = queryString ? `${table}?${queryString}` : table;
  return await query(path);
}

export async function upsert(table, data) {
  return await query(table, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data),
  });
}

export async function remove(table, queryString) {
  return await query(`${table}?${queryString}`, { method: 'DELETE' });
}

/** Chama uma Edge Function do Supabase */
export async function callEdgeFunction(functionName, payload = {}) {
  const { url, key } = getConfig();
  if (!url || !key) throw new Error('Supabase não configurado.');

  const res = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Edge Function "${functionName}" [${res.status}]: ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const supabase = { query, select, upsert, remove, callEdgeFunction, testConnection, isConfigured };
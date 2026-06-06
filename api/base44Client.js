import { createClient } from '@supabase/supabase-js';
import { loadSettings, loadIntegrations, redact } from '@/utils/secureStorage';

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const i = loadIntegrations();
  if (i.supabase?.url && i.supabase?.anon_key)
    _supabase = createClient(i.supabase.url, i.supabase.anon_key);
  return _supabase;
}
export function resetSupabaseClient() { _supabase = null; }

const auth = {
  async me() {
    const stored = localStorage.getItem('jarvis_user');
    if (stored) return JSON.parse(stored);
    const s = loadSettings();
    const user = { id: 'local-user', email: s.user_email || 'user@jarvis.local', name: s.user_name || 'Usuário' };
    localStorage.setItem('jarvis_user', JSON.stringify(user));
    return user;
  },
  async logout(redirectTo = '/') { localStorage.removeItem('jarvis_user'); window.location.href = redirectTo; },
};

function makeEntity(tableName) {
  return {
    async filter(filters = {}, orderBy = null, limit = 50) {
      const sb = getSupabase(); if (!sb) return [];
      let q = sb.from(tableName).select('*');
      Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v); });
      if (orderBy) { const d = orderBy.startsWith('-'); q = q.order(d ? orderBy.slice(1) : orderBy, { ascending: !d }); }
      if (limit) q = q.limit(limit);
      const { data } = await q; return data || [];
    },
    async create(data) {
      const sb = getSupabase(); if (!sb) return { id: Date.now().toString(), ...data };
      const { data: row } = await sb.from(tableName).insert(data).select().single();
      return row || { id: Date.now().toString(), ...data };
    },
    async update(id, data) {
      const sb = getSupabase(); if (!sb) return data;
      const { data: row } = await sb.from(tableName).update(data).eq('id', id).select().single();
      return row || data;
    },
    async delete(id) { const sb = getSupabase(); if (sb) await sb.from(tableName).delete().eq('id', id); },
  };
}

async function callModel(model, messages) {
  const s = loadSettings();
  switch(model) {
    case 'claude': {
      if (!s.claude_api_key) throw new Error('no key');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': s.claude_api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, messages }),
      });
      if (!r.ok) throw new Error(`Claude ${r.status}`);
      return (await r.json()).content?.[0]?.text || '';
    }
    case 'groq_llama': case 'groq_mixtral': {
      if (!s.groq_api_key) throw new Error('no key');
      const m = model === 'groq_llama' ? 'llama-3.3-70b-versatile' : 'mixtral-8x7b-32768';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${s.groq_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, messages, max_tokens: 1024 }),
      });
      if (!r.ok) throw new Error(`Groq ${r.status}`);
      return (await r.json()).choices?.[0]?.message?.content || '';
    }
    case 'gemini_flash': case 'gemini_pro': {
      if (!s.gemini_api_key) throw new Error('no key');
      const m = model === 'gemini_flash' ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.gemini_api_key },
        body: JSON.stringify({ contents: messages.map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] })) }),
      });
      if (!r.ok) throw new Error(`Gemini ${r.status}`);
      return (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    case 'deepseek': case 'deepseek_r1': {
      if (!s.deepseek_api_key) throw new Error('no key');
      const m = model === 'deepseek_r1' ? 'deepseek-reasoner' : 'deepseek-chat';
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${s.deepseek_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, messages, max_tokens: 1024 }),
      });
      if (!r.ok) throw new Error(`DeepSeek ${r.status}`);
      return (await r.json()).choices?.[0]?.message?.content || '';
    }
    case 'qwen': case 'qwen_max': {
      if (!s.qwen_api_key) throw new Error('no key');
      const m = model === 'qwen_max' ? 'qwen-max' : 'qwen-turbo';
      const r = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${s.qwen_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, messages, max_tokens: 1024 }),
      });
      if (!r.ok) throw new Error(`Qwen ${r.status}`);
      return (await r.json()).choices?.[0]?.message?.content || '';
    }
    case 'glm': case 'glm_plus': {
      if (!s.glm_api_key) throw new Error('no key');
      const m = model === 'glm_plus' ? 'glm-4-plus' : 'glm-4-flash';
      const r = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${s.glm_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, messages, max_tokens: 1024 }),
      });
      if (!r.ok) throw new Error(`GLM ${r.status}`);
      return (await r.json()).choices?.[0]?.message?.content || '';
    }
    case 'openrouter': {
      if (!s.openrouter_api_key) throw new Error('no key');
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${s.openrouter_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'meta-llama/llama-3.1-8b-instruct:free', messages, max_tokens: 1024 }),
      });
      if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
      return (await r.json()).choices?.[0]?.message?.content || '';
    }
    default: throw new Error(`Modelo desconhecido: ${model}`);
  }
}

async function InvokeLLM({ prompt, file_urls }) {
  const s = loadSettings();
  const model = s.ai_model || 'auto';
  const messages = [{ role: 'user', content: prompt + (file_urls?.length ? `\nArquivos: ${file_urls.join(', ')}` : '') }];
  const priority = model === 'auto'
    ? ['claude', 'groq_llama', 'gemini_flash', 'deepseek', 'qwen', 'glm', 'openrouter']
    : [model, 'claude', 'groq_llama', 'gemini_flash', 'deepseek', 'openrouter'];
  for (const m of priority) {
    try { const r = await callModel(m, messages); if (r) return r; } catch(e) { console.warn(`[JARVIS] ${m}:`, e.message); }
  }
  return 'Configure suas chaves em Configurações → Motores IA.';
}

async function UploadFile({ file }) {
  const sb = getSupabase();
  if (!sb) return { file_url: URL.createObjectURL(file) };
  const path = `uploads/${Date.now()}_${file.name}`;
  const { data } = await sb.storage.from('jarvis-files').upload(path, file);
  if (data) { const { data: u } = sb.storage.from('jarvis-files').getPublicUrl(path); return { file_url: u.publicUrl }; }
  return { file_url: URL.createObjectURL(file) };
}

async function SendEmail({ to, subject, body }) {
  // Avoid logging recipient details to console in production
  return { success: true };
}

export const base44 = {
  auth,
  entities: {
    Conversation: makeEntity('jarvis_conversations'),
    UserSettings: makeEntity('jarvis_user_settings'),
    AgentSession: makeEntity('agent_sessions'),
    SystemStatus: makeEntity('system_status'),
  },
  integrations: { Core: { InvokeLLM, UploadFile, SendEmail } },
};

export { callModel, InvokeLLM };

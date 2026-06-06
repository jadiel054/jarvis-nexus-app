/**
 * useVercel — Monitor de deploys da Vercel para o JARVIS.
 * Suporta: status do último deploy, leitura de logs e diagnóstico de falhas.
 */
import { base44 } from '@/api/base44Client';
import { loadIntegrations } from '@/utils/secureStorage';

function getVercelToken() {
  try {
    return loadIntegrations().vercel?.api_key || null;
  } catch { return null; }
}

function getVercelProjectIds() {
  try {
    const raw = loadIntegrations().vercel?.project_ids || '';
    return raw.split(',').map(r => r.trim()).filter(Boolean);
  } catch { return []; }
}

/** Busca o último deploy de todos os projetos configurados */
export async function getLatestDeploys() {
  const token = getVercelToken();
  if (!token) return { error: 'Token Vercel não configurado.' };

  try {
    const projectIds = getVercelProjectIds();
    const url = projectIds.length > 0
      ? `https://api.vercel.com/v6/deployments?limit=10&projectId=${projectIds[0]}`
      : 'https://api.vercel.com/v6/deployments?limit=10';

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { error: `Erro ao buscar deploys: HTTP ${res.status}` };

    const data = await res.json();
    const deploys = (data.deployments || []).slice(0, 5).map(d => ({
      id: d.uid,
      name: d.name,
      state: d.state, // READY, ERROR, BUILDING, CANCELED
      url: d.url ? `https://${d.url}` : null,
      createdAt: d.createdAt,
      meta: d.meta,
    }));

    return { deploys, total: data.pagination?.count };
  } catch (e) { return { error: e.message }; }
}

/** Lê os logs de build de um deploy específico */
export async function getDeployLogs(deployId) {
  const token = getVercelToken();
  if (!token) return { error: 'Token Vercel não configurado.' };

  try {
    const res = await fetch(`https://api.vercel.com/v2/deployments/${deployId}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { error: `Erro ao buscar logs: HTTP ${res.status}` };

    const text = await res.text();
    // Parse NDJSON format
    const lines = text.split('\n').filter(Boolean);
    const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const logLines = events
      .filter(e => e.type === 'stderr' || e.type === 'stdout' || e.type === 'build')
      .map(e => e.payload?.text || e.text || '')
      .filter(Boolean)
      .join('\n');

    return { logs: logLines.slice(0, 5000) };
  } catch (e) { return { error: e.message }; }
}

/** Diagnostica um deploy com falha usando o LLM */
export async function diagnoseFailedDeploy(deployId, deployName) {
  const logsResult = await getDeployLogs(deployId);
  if (logsResult.error) {
    return `⚠️ Não foi possível ler os logs do deploy: ${logsResult.error}`;
  }

  if (!logsResult.logs || logsResult.logs.trim().length < 10) {
    return `ℹ️ Logs do deploy "${deployName}" estão vazios ou indisponíveis. Verifique manualmente na Vercel.`;
  }

  try {
    const diagnosis = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é JARVIS, especialista em DevOps. Analise os logs de build da Vercel abaixo e:
1. Identifique a causa raiz do erro
2. Sugira a correção exata no código
3. Formate a resposta em markdown com seções claras

PROJETO: ${deployName}
LOGS:
\`\`\`
${logsResult.logs}
\`\`\`

Seja direto e técnico. Aponte o arquivo e linha se possível.`,
    });
    return diagnosis;
  } catch (e) {
    return `⚠️ Erro ao analisar logs: ${e.message}`;
  }
}
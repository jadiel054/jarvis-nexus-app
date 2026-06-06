/**
 * git_operator — Agent Tool para commits e PRs no jarvis-nexus-core.
 * Integra com GitHub API e Edge Functions do Supabase (Zarith-SaaS).
 */
import { gitPushHandler, readRepoFile, listRepoContents, commitFile, commitFile as gitCommitFile, getGitHubToken, listAllRepos, createRepo, deleteRepo } from '../integrations/useGitHub';
import { runSandboxTest } from '../integrations/sandboxRunner';
import { supabase } from '@/lib/supabaseClient';
import { logAgentSession } from './databaseOracle';

const DEFAULT_REPO = 'jarvis-nexus-core';

// ── Session-level repo cache (populated automatically on first use) ──────────
let _repoCache = null; // null = not loaded yet, [] = loaded but empty

export async function getRepoCache() {
  if (_repoCache !== null) return _repoCache;
  const token = getGitHubToken();
  if (!token) { _repoCache = []; return []; }
  try {
    const res = await fetch('https://api.github.com/user/repos?type=all&sort=updated&per_page=100', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) { _repoCache = []; return []; }
    const data = await res.json();
    _repoCache = data.map(r => ({ name: r.name, full_name: r.full_name, private: r.private, language: r.language, stars: r.stargazers_count, url: r.html_url }));
    return _repoCache;
  } catch (e) {
    console.warn('[GitOperator] Failed to fetch repo cache:', e.message);
    _repoCache = []; return [];
  }
}

export function invalidateRepoCache() { _repoCache = null; }

async function resolveRepo(repo) {
  if (!repo) {
    const stored = JSON.parse(localStorage.getItem('jarvis_integrations') || '{}');
    const manualFirst = (stored.github?.repos || '').split(',').map(r => r.trim()).filter(Boolean)[0];
    if (manualFirst) return manualFirst;
    const cache = await getRepoCache();
    return cache[0]?.name || DEFAULT_REPO;
  }
  // Search in cache first
  const cache = await getRepoCache();
  const found = cache.find(r => r.name.toLowerCase().includes(repo.toLowerCase()));
  if (found) return found.name;
  // Not in cache — try fetching directly from API (user may have typed exact name)
  const token = getGitHubToken();
  if (token) {
    try {
      const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}` } });
      if (userRes.ok) {
        const { login } = await userRes.json();
        const repoRes = await fetch(`https://api.github.com/repos/${login}/${repo}`, { headers: { Authorization: `Bearer ${token}` } });
        if (repoRes.ok) return repo; // Exists — use as-is
      }
    } catch (e) {
      console.warn('[GitOperator] Failed to resolve repo:', e.message);
    }
  }
  return repo; // Fallback: use what the user said
}

/**
 * Commit + PR com sandbox automático.
 * Tenta chamar a Edge Function 'github-tool' do Supabase primeiro;
 * cai para a API GitHub direta se não disponível.
 */
export async function gitOperatorCommitAndPR(filePath, content, description, repo = null) {
  const token = getGitHubToken();
  if (!token) return { error: '🔑 Token do GitHub não configurado. Acesse Configurações → Integrações.' };

  const targetRepo = await resolveRepo(repo);

  // Sandbox validation first
  const ext = filePath.split('.').pop()?.toLowerCase();
  let sandboxResult = { passed: true, errors: [], verdict: 'APROVADO' };
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'dart'].includes(ext)) {
    sandboxResult = await runSandboxTest(content, filePath);
    if (!sandboxResult.passed) {
      return {
        blocked: true,
        sandboxResult,
        message: `🚫 **Commit bloqueado pelo Sandbox**\n\n**Veredicto:** ${sandboxResult.verdict}\n\n**Erros:**\n${sandboxResult.errors.map(e => `- ${e}`).join('\n')}\n\n**Sugestão:** ${sandboxResult.suggestion}`,
      };
    }
  }

  // Try Edge Function first
  if (supabase.isConfigured()) {
    try {
      const edgeResult = await supabase.callEdgeFunction('github-tool', {
        action: 'commit_and_pr',
        repo: targetRepo,
        filePath,
        content,
        description,
      });
      if (edgeResult?.success) {
        await logAgentSession('git_operator', 'commit_and_pr', { repo: targetRepo, filePath, prUrl: edgeResult.prUrl });
        return { ...edgeResult, sandboxResult, source: 'edge_function' };
      }
    } catch (e) {
      console.warn('[GitOperator] Edge function failed, falling back to direct API:', e.message);
    }
  }

  // Direct GitHub API fallback
  const result = await gitPushHandler(targetRepo, filePath, content, description);
  if (!result.error) {
    await logAgentSession('git_operator', 'commit_and_pr', { repo: targetRepo, filePath, prUrl: result.prUrl });
  }
  return { ...result, sandboxResult, source: 'github_api' };
}

/**
 * Commit rápido sem PR (direto na main).
 */
export async function gitOperatorQuickCommit(filePath, content, message, repo = null) {
  const token = getGitHubToken();
  if (!token) return { error: '🔑 Token do GitHub não configurado.' };
  const targetRepo = await resolveRepo(repo);
  const result = await commitFile(targetRepo, filePath, content, `[JARVIS] ${message}`, 'main');
  if (!result.error) {
    await logAgentSession('git_operator', 'quick_commit', { repo: targetRepo, filePath });
  }
  return result;
}

/**
 * Analisa um arquivo uploadado e decide se deve sugerir commit.
 */
export async function analyzeUploadForCommit(file, fileContent) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const isCode = ['js', 'jsx', 'ts', 'tsx', 'py', 'dart', 'json', 'yaml', 'yml', 'md', 'css', 'html'].includes(ext);
  if (!isCode) return { shouldCommit: false, reason: 'Tipo de arquivo não é código-fonte.' };

  // Local heuristic analysis — no external API calls
  const lines = fileContent.split('\n').length;
  const hasExports = /export\s+(default|function|class|const)/i.test(fileContent);
  const hasImports = /import\s+.+\s+from/i.test(fileContent);
  const isConfig = /\.(json|yaml|yml)$/.test(file.name);
  const isComponent = /\.(jsx|tsx)$/.test(file.name) && hasExports;

  const shouldCommit = lines > 5 && (hasExports || hasImports || isConfig);
  const impact = isComponent ? 'Componente de interface — afeta UI diretamente'
    : isConfig ? 'Arquivo de configuração — afeta build/deploy'
    : hasExports ? 'Módulo com exports — pode ser importado por outros arquivos'
    : 'Arquivo de suporte';

  const suggestedPath = isComponent ? `src/components/${file.name}`
    : isConfig ? file.name
    : `src/${file.name}`;

  return {
    shouldCommit,
    reason: shouldCommit ? `${lines} linhas, contém ${hasExports ? 'exports' : 'imports'} — candidato a commit.` : 'Arquivo muito simples ou sem estrutura de módulo.',
    suggestedPath,
    impact,
    commitMessage: `[JARVIS] Add ${file.name}`,
  };
}

/**
 * Lista todos os repositórios do usuário.
 */
export async function gitOperatorListAllRepos() {
  const token = getGitHubToken();
  if (!token) return { error: '🔑 Token do GitHub não configurado. Acesse Configurações → Integrações.' };
  // Refresh cache on explicit list request
  invalidateRepoCache();
  const cache = await getRepoCache();
  if (cache.length === 0) return { error: 'Nenhum repositório encontrado ou erro na listagem.' };
  await logAgentSession('git_operator', 'list_all_repos', { count: cache.length });
  return { success: true, repos: cache };
}

/**
 * Cria um novo repositório no GitHub.
 */
export async function gitOperatorCreateRepo(name, options = {}) {
  const token = getGitHubToken();
  if (!token) return { error: '🔑 Token do GitHub não configurado.' };
  const result = await createRepo(name, options);
  if (result.success) {
    await logAgentSession('git_operator', 'create_repo', { repo: name, url: result.url });
  }
  return result;
}

/**
 * PROTOCOLO_EXTINCAO — Exclui um repositório SOMENTE após validação do PIN de 6 dígitos.
 * Nunca chamar diretamente sem passar o pinConfirmation correto.
 */
export async function gitOperatorProtocoloExtincao(repo, pinConfirmation) {
  const token = getGitHubToken();
  if (!token) return { error: '🔑 Token do GitHub não configurado.' };

  // Validate PIN
  const storedPin = localStorage.getItem('jarvis_security_pin');
  if (!storedPin) {
    return {
      blocked: true,
      error: '🛡️ **PROTOCOLO_EXTINCAO BLOQUEADO**\n\nNenhum PIN de segurança configurado. Acesse **Configurações → Segurança** e defina seu PIN de 6 dígitos antes de usar este protocolo.',
    };
  }
  if (!pinConfirmation || String(pinConfirmation) !== String(storedPin)) {
    await logAgentSession('git_operator', 'extincao_denied', { repo, reason: 'PIN incorreto' });
    return {
      blocked: true,
      error: `🚫 **PROTOCOLO_EXTINCAO — ACESSO NEGADO**\n\nPIN incorreto. Operação abortada.\n\n_Esta tentativa foi registrada no Oracle._`,
    };
  }

  // PIN validated — proceed with deletion
  await logAgentSession('git_operator', 'extincao_initiated', { repo, at: new Date().toISOString() });
  const result = await deleteRepo(repo);

  if (result.success) {
    await logAgentSession('git_operator', 'extincao_completed', { repo, at: new Date().toISOString() });
    return {
      success: true,
      message: `⚠️ **PROTOCOLO_EXTINCAO EXECUTADO**\n\nRepositório \`${repo}\` excluído permanentemente.\n\n_Operação registrada no Oracle com timestamp._`,
    };
  }
  return { error: `Falha ao excluir repositório: ${result.error}` };
}

export { readRepoFile as gitOperatorReadFile, listRepoContents as gitOperatorListFiles };
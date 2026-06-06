/**
 * useGitHub — Hook para acesso COMPLETO à API do GitHub via token salvo.
 * Suporta: leitura, criação de branches, edição de arquivos, commits e PRs.
 */
import { loadIntegrations } from '@/utils/secureStorage';

export function getGitHubToken() {
  try {
    return loadIntegrations().github?.token || null;
  } catch { return null; }
}

export function getConfiguredRepos() {
  try {
    const raw = loadIntegrations().github?.repos || '';
    return raw.split(',').map(r => r.trim()).filter(Boolean);
  } catch { return []; }
}

async function getOwner(token) {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Token inválido ou sem permissão.');
  return (await res.json()).login;
}

/** Lista arquivos/pastas em um repositório */
export async function listRepoContents(repo, path = '', owner = null) {
  const token = getGitHubToken();
  if (!token) return { error: 'Token do GitHub não configurado. Acesse Configurações → Integrações.' };
  try {
    const resolvedOwner = owner || await getOwner(token);
    const url = `https://api.github.com/repos/${resolvedOwner}/${repo}/contents/${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return { error: `Repo "${repo}" não encontrado ou sem acesso.` };
    const items = await res.json();
    if (!Array.isArray(items)) return { error: 'Resposta inesperada da API.' };
    return {
      owner: resolvedOwner, repo, path: path || '/',
      items: items.map(i => ({ name: i.name, type: i.type, size: i.size, path: i.path })),
    };
  } catch (e) { return { error: e.message }; }
}

/** Lê o conteúdo de um arquivo (máx ~50KB decodificado) */
export async function readRepoFile(repo, filePath, owner = null) {
  const token = getGitHubToken();
  if (!token) return { error: 'Token do GitHub não configurado.' };
  try {
    const resolvedOwner = owner || await getOwner(token);
    const url = `https://api.github.com/repos/${resolvedOwner}/${repo}/contents/${filePath}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return { error: `Arquivo "${filePath}" não encontrado.` };
    const data = await res.json();
    if (data.encoding === 'base64' && data.content) {
      const decoded = atob(data.content.replace(/\n/g, ''));
      return { path: filePath, content: decoded.slice(0, 50000), size: data.size, sha: data.sha };
    }
    return { error: 'Formato de arquivo não suportado.' };
  } catch (e) { return { error: e.message }; }
}

/** Obtém o SHA da branch atual (necessário para criar branches e commits) */
export async function getBranchSha(repo, branch = 'main', owner = null) {
  const token = getGitHubToken();
  if (!token) return { error: 'Token não configurado.' };
  try {
    const resolvedOwner = owner || await getOwner(token);
    const res = await fetch(
      `https://api.github.com/repos/${resolvedOwner}/${repo}/git/ref/heads/${branch}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return { error: `Branch "${branch}" não encontrada.` };
    const data = await res.json();
    return { sha: data.object.sha, owner: resolvedOwner };
  } catch (e) { return { error: e.message }; }
}

/** Cria uma nova branch a partir de outra (default: main) */
export async function createBranch(repo, branchName, fromBranch = 'main', owner = null) {
  const token = getGitHubToken();
  if (!token) return { error: 'Token não configurado.' };
  try {
    const resolvedOwner = owner || await getOwner(token);
    const shaResult = await getBranchSha(repo, fromBranch, resolvedOwner);
    if (shaResult.error) return shaResult;

    const res = await fetch(
      `https://api.github.com/repos/${resolvedOwner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: shaResult.sha }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      return { error: err.message || `Erro ao criar branch.` };
    }
    return { success: true, branch: branchName, owner: resolvedOwner, repo };
  } catch (e) { return { error: e.message }; }
}

/** Edita (ou cria) um arquivo em um repo e faz commit */
export async function commitFile(repo, filePath, content, commitMessage, branch = 'main', owner = null) {
  const token = getGitHubToken();
  if (!token) return { error: 'Token não configurado.' };
  try {
    const resolvedOwner = owner || await getOwner(token);

    // Get existing file SHA (for update) — null if new file
    let existingSha = null;
    const existing = await readRepoFile(repo, filePath, resolvedOwner);
    if (!existing.error) existingSha = existing.sha;

    const encoded = btoa(unescape(encodeURIComponent(content)));
    const body = {
      message: commitMessage,
      content: encoded,
      branch,
    };
    if (existingSha) body.sha = existingSha;

    const res = await fetch(
      `https://api.github.com/repos/${resolvedOwner}/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      return { error: err.message || 'Erro ao fazer commit.' };
    }
    const data = await res.json();
    return {
      success: true,
      filePath,
      branch,
      commitSha: data.commit?.sha,
      commitUrl: data.commit?.html_url,
    };
  } catch (e) { return { error: e.message }; }
}

/** Cria um Pull Request */
export async function createPullRequest(repo, title, body, headBranch, baseBranch = 'main', owner = null) {
  const token = getGitHubToken();
  if (!token) return { error: 'Token não configurado.' };
  try {
    const resolvedOwner = owner || await getOwner(token);
    const res = await fetch(
      `https://api.github.com/repos/${resolvedOwner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, head: headBranch, base: baseBranch }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      return { error: err.message || 'Erro ao criar PR.' };
    }
    const data = await res.json();
    return { success: true, prNumber: data.number, prUrl: data.html_url, title: data.title };
  } catch (e) { return { error: e.message }; }
}

/** Lista TODOS os repositórios do usuário autenticado */
export async function listAllRepos(visibility = 'all', sort = 'updated') {
  const token = getGitHubToken();
  if (!token) return { error: 'Token do GitHub não configurado.' };
  try {
    const res = await fetch(
      `https://api.github.com/user/repos?type=${visibility}&sort=${sort}&per_page=100`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return { error: `Erro ao listar repos: HTTP ${res.status}` };
    const data = await res.json();
    return {
      success: true,
      repos: data.map(r => ({
        name: r.name,
        full_name: r.full_name,
        private: r.private,
        description: r.description,
        updated_at: r.updated_at,
        language: r.language,
        stars: r.stargazers_count,
        url: r.html_url,
      })),
    };
  } catch (e) { return { error: e.message }; }
}

/** Cria um novo repositório */
export async function createRepo(name, options = {}) {
  const token = getGitHubToken();
  if (!token) return { error: 'Token do GitHub não configurado.' };
  try {
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: options.description || '',
        private: options.private ?? false,
        auto_init: options.auto_init ?? true,
        gitignore_template: options.gitignore || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { error: err.message || 'Erro ao criar repositório.' };
    }
    const data = await res.json();
    return { success: true, name: data.name, full_name: data.full_name, url: data.html_url, clone_url: data.clone_url };
  } catch (e) { return { error: e.message }; }
}

/** Exclui um repositório — REQUER confirmação via PIN (protocolo_extincao) */
export async function deleteRepo(repo, owner = null) {
  const token = getGitHubToken();
  if (!token) return { error: 'Token do GitHub não configurado.' };
  try {
    const resolvedOwner = owner || await getOwner(token);
    const res = await fetch(
      `https://api.github.com/repos/${resolvedOwner}/${repo}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      }
    );
    if (res.status === 204) return { success: true, repo, owner: resolvedOwner };
    const err = await res.json().catch(() => ({}));
    return { error: err.message || `Erro ao excluir repo (HTTP ${res.status})` };
  } catch (e) { return { error: e.message }; }
}

/**
 * git_push_handler — Handler completo que:
 * 1. Cria uma branch jarvis/fix-{timestamp}
 * 2. Faz commit do arquivo
 * 3. Abre PR automaticamente
 */
export async function gitPushHandler(repo, filePath, newContent, description) {
  const timestamp = Date.now();
  const branchName = `jarvis/fix-${timestamp}`;
  const commitMsg = `[JARVIS] ${description || `Update ${filePath}`}`;

  // Step 1: Create branch
  const branchResult = await createBranch(repo, branchName, 'main');
  if (branchResult.error) return { error: `Falha ao criar branch: ${branchResult.error}` };

  // Step 2: Commit file to new branch
  const commitResult = await commitFile(repo, filePath, newContent, commitMsg, branchName, branchResult.owner);
  if (commitResult.error) return { error: `Falha no commit: ${commitResult.error}` };

  // Step 3: Open PR
  const prResult = await createPullRequest(
    repo,
    `[JARVIS] ${description || `Update ${filePath}`}`,
    `## Alterações propostas pelo JARVIS\n\n**Arquivo:** \`${filePath}\`\n**Branch:** \`${branchName}\`\n\n${description || 'Melhoria automática aplicada.'}`,
    branchName,
    'main',
    branchResult.owner
  );
  if (prResult.error) return { error: `Falha ao abrir PR: ${prResult.error}` };

  return {
    success: true,
    branch: branchName,
    commitSha: commitResult.commitSha,
    prUrl: prResult.prUrl,
    prNumber: prResult.prNumber,
  };
}
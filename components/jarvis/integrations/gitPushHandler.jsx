/**
 * gitPushHandler — Handler de escrita no GitHub para o JARVIS.
 * Interpreta intenções de escrita do usuário e executa:
 *   - Criação de branch
 *   - Edição/criação de arquivos com commit
 *   - Criação de Pull Requests
 * Inclui sandbox simulado (validação antes do commit).
 */

import { createBranch, commitFile, createPullRequest, readRepoFile } from './useGitHub';
import { getConfiguredRepos } from './useGitHub';

/**
 * Detecta intenções de escrita no GitHub.
 */
export function detectGitWriteIntent(text) {
  if (!text) return null;

  // Criar branch
  if (/criar?\s+(?:uma?\s+)?branch\s+([^\s]+)/i.test(text)) {
    const m = text.match(/criar?\s+(?:uma?\s+)?branch\s+([^\s]+)/i);
    return { action: 'create_branch', branch: m[1], rawText: text };
  }

  // Editar/criar arquivo + commit
  if (/(?:editar?|modificar?|atualizar?|criar?)\s+(?:o\s+)?arquivo\s+([^\s]+)/i.test(text) &&
      /(?:commit|salvar?|enviar?)/i.test(text)) {
    const m = text.match(/(?:editar?|modificar?|atualizar?|criar?)\s+(?:o\s+)?arquivo\s+([^\s]+)/i);
    const repoM = text.match(/(?:em|no\s+repo|d[eo])\s+([A-Za-z0-9_\-]+)/i);
    return { action: 'commit_file', file: m[1], repo: repoM?.[1], rawText: text };
  }

  // Pull Request
  if (/pull\s*request|criar?\s+pr|abrir?\s+pr/i.test(text)) {
    return { action: 'create_pr', rawText: text };
  }

  // Push direto
  if (/(?:push|enviar?)\s+(?:para?\s+)?(?:o\s+)?([A-Za-z0-9_\-]+)/i.test(text) &&
      /(?:branch|reposit[oó]rio|repo)/i.test(text)) {
    return { action: 'push', rawText: text };
  }

  return null;
}

/**
 * Sandbox simulado: valida o conteúdo do código antes do commit.
 * Retorna { passed, issues }
 */
export function runSandboxCheck(code, filename = '') {
  const issues = [];

  // Checa sintaxe básica JS/TS
  if (filename.match(/\.(js|jsx|ts|tsx)$/i)) {
    // Checa parênteses/chaves/colchetes desbalanceados
    const opens = (code.match(/[({[]/g) || []).length;
    const closes = (code.match(/[)}\]]/g) || []).length;
    if (Math.abs(opens - closes) > 2) {
      issues.push('⚠️ Possível erro de sintaxe: parênteses/chaves desbalanceados.');
    }
    // Checa console.log em código de produção
    if (code.includes('console.log') && !filename.includes('test')) {
      issues.push('ℹ️ Aviso: `console.log` encontrado — considere remover antes do commit.');
    }
    // Checa TODO não resolvido
    if (/TODO:|FIXME:/i.test(code)) {
      issues.push('ℹ️ Aviso: Existem TODOs/FIXMEs não resolvidos no arquivo.');
    }
  }

  // Checa arquivo Python
  if (filename.match(/\.py$/i)) {
    if (/\bprint\s*\(/i.test(code) && !filename.includes('test')) {
      issues.push('ℹ️ Aviso: `print()` encontrado — considere usar logging.');
    }
  }

  return {
    passed: issues.filter(i => i.startsWith('⚠️')).length === 0,
    issues,
  };
}

/**
 * Executa o fluxo completo de push: branch → sandbox → commit → PR opcional.
 * @param {object} opts
 * @param {function} onStatus - Callback para atualizar o ThinkingStatus
 */
export async function executePush({
  repo,
  filePath,
  newContent,
  commitMessage,
  branchName,
  baseBranch = 'main',
  createPR = false,
  prTitle = '',
  prBody = '',
  onStatus = () => {},
}) {
  const results = [];

  // 1. Sandbox check
  onStatus(`Jarvis está executando sandbox check em ${filePath}...`);
  const sandbox = runSandboxCheck(newContent, filePath);
  if (!sandbox.passed) {
    return {
      success: false,
      stage: 'sandbox',
      message: `❌ Commit cancelado — sandbox detectou erros:\n${sandbox.issues.join('\n')}`,
      issues: sandbox.issues,
    };
  }
  if (sandbox.issues.length > 0) {
    results.push(`⚠️ Avisos do sandbox:\n${sandbox.issues.join('\n')}`);
  }

  // 2. Criar branch (se não for main/master)
  if (branchName && branchName !== baseBranch) {
    onStatus(`Jarvis está criando branch "${branchName}" em ${repo}...`);
    const branchResult = await createBranch(repo, branchName, baseBranch);
    if (branchResult.error) {
      // Branch pode já existir — tudo bem
      if (!branchResult.error.includes('already exists') && !branchResult.error.includes('Reference already')) {
        results.push(`⚠️ Branch: ${branchResult.error} (usando ${baseBranch})`);
        branchName = baseBranch;
      }
    } else {
      results.push(`✅ Branch "${branchName}" criada.`);
    }
  }

  // 3. Commit do arquivo
  onStatus(`Jarvis está fazendo commit de ${filePath} em ${repo}/${branchName || baseBranch}...`);
  const commitResult = await commitFile(repo, filePath, newContent, commitMessage, branchName || baseBranch);
  if (commitResult.error) {
    return {
      success: false,
      stage: 'commit',
      message: `❌ Erro no commit: ${commitResult.error}`,
    };
  }
  results.push(`✅ Commit realizado: \`${commitResult.commitSha?.slice(0, 7)}\``);
  if (commitResult.url) results.push(`🔗 ${commitResult.url}`);

  // 4. Pull Request (opcional)
  if (createPR && branchName && branchName !== baseBranch) {
    onStatus(`Jarvis está abrindo Pull Request em ${repo}...`);
    const prResult = await createPullRequest(repo, prTitle || commitMessage, prBody || commitMessage, branchName, baseBranch);
    if (prResult.error) {
      results.push(`⚠️ PR não criado: ${prResult.error}`);
    } else {
      results.push(`✅ PR #${prResult.pr_number} aberto: [${prResult.title}](${prResult.url})`);
    }
  }

  return {
    success: true,
    message: results.join('\n'),
    commitSha: commitResult.commitSha,
  };
}
/**
 * deploy_analyst — Agent Tool para monitoramento autônomo de deploys Vercel.
 * - Verifica deploys em background
 * - Se falhar: lê logs e gera auto-correção sem pedir ao usuário
 * - Persiste diagnósticos via database_oracle
 */
import { getLatestDeploys, getDeployLogs } from '../integrations/useVercel';
import { oracleWrite, oracleRead } from './databaseOracle';

/** Busca deploys com falha que ainda não foram diagnosticados */
export async function getUndiagnosedFailures() {
  const result = await getLatestDeploys();
  if (result.error || !result.deploys) return [];

  const failed = result.deploys.filter(d => d.state === 'ERROR' || d.state === 'CANCELED');
  const undiagnosed = [];

  for (const deploy of failed) {
    const cached = await oracleRead(`deploy_diagnosed_${deploy.id}`);
    if (!cached.found) {
      undiagnosed.push(deploy);
    }
  }

  return undiagnosed;
}

/** Diagnóstico local de logs sem IA externa */
function analyzeLogs(logs, projectName) {
  const text = typeof logs === 'string' ? logs : JSON.stringify(logs);
  const lower = text.toLowerCase();

  let rootCause = 'Erro desconhecido — verifique os logs completos.';
  let affectedFiles = [];
  let correction = '';
  let canAutoCommit = false;

  if (/cannot find module|module not found/i.test(text)) {
    const match = text.match(/cannot find module ['"]([^'"]+)['"]/i);
    rootCause = `Módulo não encontrado: ${match?.[1] || 'desconhecido'}`;
    correction = match?.[1]
      ? `Execute \`npm install ${match[1]}\` ou verifique o caminho do import.`
      : 'Verifique seus imports e o arquivo package.json.';
  } else if (/syntaxerror|unexpected token|unexpected end/i.test(text)) {
    rootCause = 'Erro de sintaxe JavaScript/TypeScript no build.';
    correction = 'Verifique colchetes, vírgulas e ponto-e-vírgulas nos arquivos alterados.';
  } else if (/type error|typeerror/i.test(text)) {
    rootCause = 'TypeError detectado — provável incompatibilidade de tipos ou acesso a propriedade undefined.';
    correction = 'Adicione verificações de null/undefined nas propriedades acessadas.';
  } else if (/out of memory|heap|oom/i.test(text)) {
    rootCause = 'Esgotamento de memória durante o build.';
    correction = 'Aumente o limite de memória do Node: `NODE_OPTIONS=--max_old_space_size=4096`';
  } else if (/timeout|timed out/i.test(text)) {
    rootCause = 'Timeout durante o build ou deploy.';
    correction = 'Verifique dependências lentas ou otimize o processo de build.';
  } else if (/build failed|error during build|exit code 1/i.test(text)) {
    rootCause = 'Falha genérica de build. Verifique os logs detalhados acima.';
    correction = 'Rode `npm run build` localmente para reproduzir o erro.';
  }

  // Extract file references
  const fileMatches = text.match(/(?:at |in |file )([^\s:]+\.(js|jsx|ts|tsx|css|json))/gi) || [];
  affectedFiles = [...new Set(fileMatches.map(m => m.replace(/^(at |in |file )/i, '')).slice(0, 3))];

  return { rootCause, affectedFiles, correction, canAutoCommit, correctedCode: '', correctedFilePath: '', summary: rootCause };
}

/**
 * Auto-diagnóstico completo de um deploy com falha.
 * Retorna { deployId, deployName, diagnosis, correction, commitSuggestion }
 */
export async function autoDiagnose(deploy) {
  const logsResult = await getDeployLogs(deploy.id);
  const logs = logsResult.logs || logsResult.error || 'Logs indisponíveis';

  // Diagnóstico local via análise de padrões dos logs — sem InvokeLLM
  const diagnosis = analyzeLogs(logs, deploy.name);

  // Persist diagnosis to oracle so we don't re-diagnose
  await oracleWrite(`deploy_diagnosed_${deploy.id}`, {
    deployName: deploy.name,
    diagnosedAt: new Date().toISOString(),
    rootCause: diagnosis.rootCause,
  });

  return {
    deployId: deploy.id,
    deployName: deploy.name,
    logs: logs.slice(0, 1000),
    diagnosis,
  };
}

/**
 * Formata o resultado de auto-diagnóstico em mensagem para o chat.
 */
export function formatDiagnosisMessage(result) {
  const { deployName, diagnosis } = result;
  const d = diagnosis;

  let msg = `🚨 **Deploy falhou — Auto-diagnóstico JARVIS**\n\n`;
  msg += `**Projeto:** \`${deployName}\`\n`;
  msg += `**Causa raiz:** ${d.rootCause}\n\n`;

  if (d.affectedFiles?.length > 0) {
    msg += `**Arquivos afetados:** ${d.affectedFiles.map(f => `\`${f}\``).join(', ')}\n\n`;
  }

  if (d.correction) {
    msg += `**Correção sugerida:**\n${d.correction}\n\n`;
  }

  if (d.correctedCode && d.correctedFilePath) {
    msg += `**Código corrigido (\`${d.correctedFilePath}\`):**\n\`\`\`\n${d.correctedCode.slice(0, 800)}\n\`\`\`\n\n`;
    if (d.canAutoCommit) {
      msg += `💡 **Posso commitar esta correção automaticamente em \`jarvis-nexus-core\`.** Diga "commitar correção" para prosseguir.`;
    }
  }

  return msg;
}

/**
 * Poll autônomo — checa deploys a cada intervalo e retorna mensagens de alerta.
 * Retorna array de mensagens prontas para o chat (pode ser vazio).
 */
export async function pollDeployStatus() {
  try {
    const failures = await getUndiagnosedFailures();
    if (failures.length === 0) return [];

    const messages = [];
    for (const deploy of failures.slice(0, 2)) { // max 2 por poll
      const result = await autoDiagnose(deploy);
      messages.push(formatDiagnosisMessage(result));
    }
    return messages;
  } catch {
    return [];
  }
}
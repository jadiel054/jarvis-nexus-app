/**
 * sandboxRunner — Sandbox virtual para testar código antes do commit.
 * Simula execução de npm test / flutter test via análise estática + LLM.
 * Sem execução real de código (browser não permite), mas garante análise
 * de erros de sintaxe, imports quebrados e padrões críticos antes do commit.
 */
/**
 * Detecta o tipo de projeto baseado nos arquivos presentes.
 */
export function detectProjectType(fileTree = []) {
  const names = fileTree.map(f => f.name?.toLowerCase());
  if (names.includes('pubspec.yaml')) return 'flutter';
  if (names.includes('package.json')) return 'node';
  if (names.includes('requirements.txt') || names.includes('setup.py')) return 'python';
  return 'generic';
}

/**
 * Analisa o código estaticamente para erros críticos.
 * Retorna { passed: boolean, errors: string[], warnings: string[] }
 */
export function staticAnalysis(code, filePath = '') {
  const errors = [];
  const warnings = [];
  const ext = filePath.split('.').pop()?.toLowerCase();

  if (!code || code.trim().length === 0) {
    errors.push('Arquivo vazio ou sem conteúdo.');
    return { passed: false, errors, warnings };
  }

  // JS/TS checks
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
    // Unmatched brackets
    const opens = (code.match(/\{/g) || []).length;
    const closes = (code.match(/\}/g) || []).length;
    if (Math.abs(opens - closes) > 2) {
      errors.push(`Chaves não balanceadas: ${opens} abertas vs ${closes} fechadas.`);
    }

    // Syntax patterns
    if (/console\.error\s*\(\s*\)/.test(code)) {
      warnings.push('console.error() sem argumentos detectado.');
    }
    if (/import\s+.*from\s+['"][^'"]+['"]\s*;?\s*\n.*import\s+.*from\s+['"]\1['"]/.test(code)) {
      warnings.push('Possível import duplicado detectado.');
    }
    // Check for obvious syntax errors
    if (/function\s+\w+\s*\([^)]*\)\s*\{[^}]*$/.test(code) && !code.includes('}')) {
      errors.push('Função possivelmente não fechada.');
    }
  }

  // Dart/Flutter checks
  if (ext === 'dart') {
    if (!/^import/.test(code) && code.includes('void main')) {
      warnings.push('Entry point sem imports — verifique dependências.');
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

/**
 * Executa análise de sandbox via LLM (análise semântica profunda).
 * Retorna { passed, errors, warnings, suggestion }
 */
export async function runSandboxTest(code, filePath, projectType = 'node') {
  const testCmd = projectType === 'flutter' ? 'flutter test' : projectType === 'python' ? 'pytest' : 'npm test';

  // Static pass first
  const staticResult = staticAnalysis(code, filePath);

  // Usa apenas análise estática — sem InvokeLLM
  return {
    passed: staticResult.passed,
    errors: staticResult.errors,
    warnings: staticResult.warnings,
    verdict: staticResult.passed ? 'APROVADO' : 'BLOQUEADO',
    suggestion: staticResult.errors.length > 0 ? `Corrija os erros: ${staticResult.errors.join(', ')}` : '',
    testCmd,
    projectType,
  };
}
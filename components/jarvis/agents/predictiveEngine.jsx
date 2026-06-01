import { base44 } from '@/api/base44Client';

/**
 * Predictive Analysis Engine — scans context every 10 messages
 * to anticipate next user need and fetch real-time knowledge if needed
 */

const TOPIC_PATTERNS = {
  navigation: /\b(rota|maps|direção|chegar|endereço|localização|ir para|navegar)\b/i,
  code: /\b(código|programar|bug|erro|função|componente|api|deploy|git)\b/i,
  weather: /\b(clima|tempo|chuva|temperatura|forecast|previsão)\b/i,
  finance: /\b(dinheiro|investir|ação|cripto|bitcoin|real|dólar|salário)\b/i,
  productivity: /\b(tarefa|agenda|reunião|prazo|deadline|projeto|organizar)\b/i,
  health: /\b(saúde|exercício|academia|dieta|médico|dormir|cansado)\b/i,
  learning: /\b(aprender|estudar|curso|tutorial|como funciona|explicar)\b/i,
};

const PREDICTIONS = {
  navigation: {
    hint: '🗺️ Parece que você vai precisar de navegação. Já tenho o Maps em standby.',
    suggestion: 'Diga "abrir rota para [destino]" quando quiser.',
  },
  code: {
    hint: '💻 Modo de desenvolvimento detectado. Preparando snippets comentados e debug interno.',
    suggestion: 'Posso gerar código, revisar bugs ou arquitetar soluções completas.',
  },
  weather: {
    hint: '🌤️ Consulta meteorológica frequente. Monitorando condições em tempo real.',
    suggestion: 'Quer que eu configure alertas de chuva para sua cidade?',
  },
  finance: {
    hint: '📊 Tópico financeiro em análise. Buscando dados de mercado atualizados.',
    suggestion: 'Posso analisar investimentos ou calcular projeções financeiras.',
  },
  productivity: {
    hint: '📋 Fluxo de produtividade detectado. Organizando contexto de tarefas.',
    suggestion: 'Quer que eu crie um plano de ação estruturado?',
  },
  health: {
    hint: '💙 Assunto saúde/bem-estar detectado. Modo empático ativado.',
    suggestion: 'Posso sugerir rotinas ou buscar informações médicas verificadas.',
  },
  learning: {
    hint: '🧠 Modo de aprendizado ativo. Preparando explicações didáticas.',
    suggestion: 'Prefere aprender com exemplos práticos ou teoria primeiro?',
  },
};

/**
 * Analyze last N messages to detect dominant topic
 */
export function detectDominantTopic(messages) {
  const recentUserMsgs = messages
    .filter(m => m.role === 'user')
    .slice(-10)
    .map(m => m.content || '')
    .join(' ');

  const scores = {};
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    const matches = recentUserMsgs.match(pattern);
    scores[topic] = matches ? matches.length : 0;
  }

  const dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return dominant && dominant[1] > 0 ? dominant[0] : null;
}

/**
 * Check if we should trigger predictive scan (every 10 user messages)
 */
export function shouldTriggerPrediction(messages) {
  const userCount = messages.filter(m => m.role === 'user').length;
  return userCount > 0 && userCount % 10 === 0;
}

/**
 * Generate predictive insight message
 */
export async function generatePredictiveInsight(messages, userEmail, settings) {
  const topic = detectDominantTopic(messages);
  if (!topic) return null;

  const pred = PREDICTIONS[topic];
  if (!pred) return null;

  // Try to fetch real-time context for unknown topics via LLM
  const recentText = messages.filter(m => m.role === 'user').slice(-5).map(m => m.content).join(' ');

  let aiInsight = '';
  try {
    aiInsight = await base44.integrations.Core.InvokeLLM({
      prompt: `Análise preditiva JARVIS: O usuário ${settings.user_name || 'Jadiel'} tem conversado sobre "${topic}". 
Baseado nestas mensagens recentes: "${recentText.slice(0, 300)}"
Gere UMA dica preditiva muito curta (máx 1 frase) do que ele provavelmente precisará a seguir.
Responda em português, no estilo JARVIS — inteligente e direto. Sem prefixo.`,
    });
  } catch {}

  const scanReport = `---
🔭 **ANÁLISE PREDITIVA — VARREDURA DE CONTEXTO**

${pred.hint}

${aiInsight ? `**Previsão IA:** ${aiInsight}` : ''}

*${pred.suggestion}*

\`SCAN COMPLETO • ${messages.filter(m => m.role === 'user').length} msgs analisadas\``;

  return scanReport;
}
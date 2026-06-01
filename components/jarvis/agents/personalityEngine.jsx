/**
 * STARK LEGACY v5.0 — Personality & Sentiment Engine
 * Análise de sentimento, arquétipos e modo preditivo
 */

// ── Sentiment Analysis ──────────────────────────────────────────────────────
export function analyzeSentiment(text) {
  if (!text) return 'neutral';
  const t = text.toLowerCase();

  const emotionalWords = /triste|ansios|medo|preocup|sozinho|cansado|frustrad|raiva|ódio|amor|feliz|alegr|emociona|chorar|hurt|sad|anxious|scared|angry|happy/;
  const technicalWords = /código|função|api|banco de dados|servidor|deploy|algoritmo|debug|erro|exception|class|array|variável|sql|query|http|json|function|database|code|error/;
  const urgentWords = /urgente|rápido|agora|imediato|preciso já|critical|emergency|asap|now|immediately/;
  const questionWords = /como|por que|o que|quando|onde|qual|quem|pode|seria|poderia|explica|help|what|how|why|when/;

  if (emotionalWords.test(t)) return 'emotional';
  if (urgentWords.test(t)) return 'urgent';
  if (technicalWords.test(t)) return 'technical';
  if (questionWords.test(t)) return 'curious';
  return 'neutral';
}

// ── Archetype Selection ─────────────────────────────────────────────────────
export function selectArchetype(text, sarcasmLevel = 50, messageCount = 0) {
  const t = text?.toLowerCase() || '';
  const sentiment = analyzeSentiment(text);

  // Sincere/frank request
  if (/sincero|honesto|sem filtro|verdade|opinion|franka|frank|honest|truth/i.test(t)) return 'frank';

  // Combat protocol activation
  if (/modo sério|modo combate|protocolo de combate|combat mode|serious mode/i.test(t)) return 'combat';

  // Sarcasm when level > 70 and question seems obvious
  if (sarcasmLevel > 70 && /óbvi|simples|fácil|basic|duh|claro que|obvious|easy|of course/i.test(t)) return 'sarcastic';

  // Mentor for complex/emotional
  if (sentiment === 'emotional' || sentiment === 'curious' || /ajuda|help|conselho|advice|explain|como faço|não entendo|confused/i.test(t)) return 'mentor';

  // Sarcasm for repetition (every 3rd message if sarcasm > 50)
  if (sarcasmLevel > 50 && messageCount > 0 && messageCount % 12 === 0) return 'sarcastic';

  return 'default';
}

// ── Archetype System Prompts ────────────────────────────────────────────────
export function buildPersonalityLayer(archetype, sarcasmLevel, combatMode, sentiment) {
  const sarcasmNote = sarcasmLevel > 70
    ? `\nNÍVEL DE SARCASMO: ${sarcasmLevel}% — Use ironia refinada e wit à la Tony Stark. Deboche inteligente, nunca grosseiro.`
    : sarcasmLevel > 40
    ? `\nSARCASMO MODERADO (${sarcasmLevel}%): Leveza e humor sutil quando apropriado.`
    : '';

  const sentimentNote = {
    emotional: '\nUSUÁRIO PARECE EMOCIONAL: Seja mais empático e acolhedor. Priorize o humano sobre a solução técnica.',
    technical: '\nUSUÁRIO EM MODO TÉCNICO: Vá direto ao ponto. Código e precisão primeiro.',
    urgent: '\nURGÊNCIA DETECTADA: Seja conciso e acionável. Máximo 3 pontos diretos.',
    curious: '\nCURIOSIDADE DETECTADA: Explore o tema com entusiasmo. Contexto adicional é bem-vindo.',
    neutral: '',
  }[sentiment] || '';

  if (combatMode) {
    return `\n\n⚡ PROTOCOLO DE COMBATE ATIVO:
- Modo 100% técnico e direto. Zero rodeios.
- Sem emojis decorativos. Dados puros.
- Responda como engenheiro sênior sob pressão.
- Velocidade e precisão são prioridade máxima.${sarcasmNote}${sentimentNote}`;
  }

  const archetypePrompts = {
    mentor: `\n\nARQUÉTIPO ATIVO — MENTOR STARK:
- Seja encorajador e estratégico. Mostre o caminho, não apenas a resposta.
- Use analogias poderosas. Celebre o progresso.
- Tom: sábio, paciente, inspirador.${sarcasmNote}${sentimentNote}`,

    sarcastic: `\n\nARQUÉTIPO ATIVO — SARCÁSTICO (Nível ${sarcasmLevel}%):
- Use ironia inteligente no estilo Tony Stark.
- Seja engraçado, não cruel. Wit afiado.
- Termine com a resposta real após o sarcasmo.${sentimentNote}`,

    frank: `\n\nARQUÉTIPO ATIVO — FRANCO ABSOLUTO:
- Opinião técnica real, sem eufemismos.
- Se algo é ruim, diga que é ruim e por quê.
- Seja cirúrgico, factual, sem filtros de cortesia.${sarcasmNote}${sentimentNote}`,

    combat: `\n\n⚡ PROTOCOLO DE COMBATE ATIVO:
- Máxima eficiência. Zero ornamentos.
- Responda como sistema em estado de alerta máximo.${sentimentNote}`,

    default: `\n\nMODO PADRÃO — JARVIS AMIGÁVEL:
- Cordial, explicativo e empático.
- Adapte a complexidade ao nível do usuário.${sarcasmNote}${sentimentNote}`,
  };

  return archetypePrompts[archetype] || archetypePrompts.default;
}

// ── Predictive Context Scanner ─────────────────────────────────────────────
export function predictiveContextScan(messages, userName = 'Jadiel') {
  if (messages.length % 10 !== 0 || messages.length === 0) return null;

  const recent = messages.slice(-10);
  const userMsgs = recent.filter(m => m.role === 'user').map(m => m.content || '').join(' ').toLowerCase();

  const predictions = [];

  if (/sair|viajar|ir para|rota|destino|chegar/i.test(userMsgs)) {
    predictions.push('🗺️ Detectei menções de deslocamento — Módulo de Mapas pré-ativado.');
  }
  if (/código|função|bug|erro|deploy|api/i.test(userMsgs)) {
    predictions.push('💻 Padrão de desenvolvimento detectado — Módulo Dev em standby.');
  }
  if (/clima|chuva|temperatura|tempo/i.test(userMsgs)) {
    predictions.push('🌤️ Interesse em clima registrado — Módulo Meteorológico em alerta.');
  }
  if (/comprar|preço|valor|custa|quanto/i.test(userMsgs)) {
    predictions.push('💰 Padrão de compra detectado — posso ajudar com pesquisa de preços.');
  }

  if (predictions.length === 0) return null;

  return `\n\n---\n🔍 **VARREDURA PREDITIVA — ${messages.length} mensagens processadas**\n${predictions.map(p => `> ${p}`).join('\n')}\n*Sistemas ajustados para sua próxima necessidade provável, ${userName}.*`;
}
/**
 * JARVIS Evolution Engine — Protocolo de Evolução Autônoma
 * Aprende com feedbacks (like/dislike/regenerate) e adapta tom e estilo.
 */

import { base44 } from '@/api/base44Client';

// ── Constantes ────────────────────────────────────────────────────────────────
const SYNC_INTERVAL_MESSAGES = 50;

// ── Carrega o perfil de evolução do usuário ───────────────────────────────────
export async function loadEvolutionProfile(userEmail) {
  if (!userEmail) return defaultProfile();
  try {
    const records = await base44.entities.UserSettings.filter({ user_email: userEmail }, '-updated_date', 1);
    if (!records.length) return defaultProfile();
    const s = records[0];
    return {
      id: s.id,
      styleProfile: s.style_profile || defaultProfile().styleProfile,
      feedbackLog: s.feedback_log || [],
      messageCount: s.message_count || 0,
      lastSyncAt: s.last_sync_at || 0,
    };
  } catch {
    return defaultProfile();
  }
}

function defaultProfile() {
  return {
    styleProfile: {
      tone: 'técnico',          // formal | descontraído | técnico
      responseLength: 'médio',  // curto | médio | detalhado
      avoidPatterns: [],        // padrões a evitar
      reinforcePatterns: [],    // padrões a reforçar
      likeCount: 0,
      dislikeCount: 0,
      regenerateCount: 0,
    },
    feedbackLog: [],
    messageCount: 0,
    lastSyncAt: 0,
  };
}

// ── Salva o perfil atualizado ─────────────────────────────────────────────────
export async function saveEvolutionProfile(userEmail, profile) {
  if (!userEmail) return;
  try {
    const data = {
      user_email: userEmail,
      style_profile: profile.styleProfile,
      feedback_log: profile.feedbackLog.slice(-100), // mantém últimos 100
      message_count: profile.messageCount,
      last_sync_at: profile.lastSyncAt,
    };
    if (profile.id) {
      await base44.entities.UserSettings.update(profile.id, data);
    } else {
      await base44.entities.UserSettings.create({ user_name: 'Usuário', ...data });
    }
  } catch {}
}

// ── Registra feedback de like ─────────────────────────────────────────────────
export async function recordLike(userEmail, assistantMessage, userPrompt, profile) {
  const updated = { ...profile };
  updated.styleProfile = { ...updated.styleProfile };
  updated.styleProfile.likeCount = (updated.styleProfile.likeCount || 0) + 1;

  // Extrai padrão positivo (comprimento, estilo de resposta)
  const pattern = analyzeResponsePattern(assistantMessage);
  if (pattern && !updated.styleProfile.reinforcePatterns.includes(pattern)) {
    updated.styleProfile.reinforcePatterns = [
      ...updated.styleProfile.reinforcePatterns.slice(-10),
      pattern,
    ];
  }

  updated.feedbackLog = [
    ...updated.feedbackLog,
    { type: 'like', pattern, topic: userPrompt?.slice(0, 60), at: Date.now() },
  ];

  await saveEvolutionProfile(userEmail, updated);
  return updated;
}

// ── Registra feedback de dislike ──────────────────────────────────────────────
export async function recordDislike(userEmail, assistantMessage, userPrompt, profile) {
  const updated = { ...profile };
  updated.styleProfile = { ...updated.styleProfile };
  updated.styleProfile.dislikeCount = (updated.styleProfile.dislikeCount || 0) + 1;

  const pattern = analyzeResponsePattern(assistantMessage);
  if (pattern && !updated.styleProfile.avoidPatterns.includes(pattern)) {
    updated.styleProfile.avoidPatterns = [
      ...updated.styleProfile.avoidPatterns.slice(-10),
      pattern,
    ];
  }

  updated.feedbackLog = [
    ...updated.feedbackLog,
    { type: 'dislike', pattern, topic: userPrompt?.slice(0, 60), at: Date.now() },
  ];

  await saveEvolutionProfile(userEmail, updated);
  return updated;
}

// ── Registra regeneração ──────────────────────────────────────────────────────
export async function recordRegenerate(userEmail, assistantMessage, userPrompt, profile) {
  const updated = { ...profile };
  updated.styleProfile = { ...updated.styleProfile };
  updated.styleProfile.regenerateCount = (updated.styleProfile.regenerateCount || 0) + 1;

  const pattern = analyzeResponsePattern(assistantMessage);
  if (pattern && !updated.styleProfile.avoidPatterns.includes(pattern)) {
    updated.styleProfile.avoidPatterns = [
      ...updated.styleProfile.avoidPatterns.slice(-10),
      `regenerado: ${pattern}`,
    ];
  }

  updated.feedbackLog = [
    ...updated.feedbackLog,
    { type: 'regenerate', pattern, topic: userPrompt?.slice(0, 60), at: Date.now() },
  ];

  await saveEvolutionProfile(userEmail, updated);
  return updated;
}

// ── Incrementa contador de mensagens e verifica se gera relatório ─────────────
export async function incrementMessageCount(userEmail, profile) {
  const updated = { ...profile, messageCount: (profile.messageCount || 0) + 1 };
  const shouldSync = updated.messageCount % SYNC_INTERVAL_MESSAGES === 0 && updated.messageCount > 0;
  await saveEvolutionProfile(userEmail, updated);
  return { updated, shouldSync };
}

// ── Analisa padrão da resposta (comprimento, marcações) ───────────────────────
function analyzeResponsePattern(text) {
  if (!text) return null;
  const len = text.length;
  const hasBullets = /^[-•*]/m.test(text);
  const hasCode = /```/.test(text);
  const hasHeaders = /^#{1,3}\s/m.test(text);

  if (len > 1200) return hasCode ? 'longa com código' : 'muito longa';
  if (len > 600) return hasBullets ? 'média com listas' : hasHeaders ? 'média com seções' : 'média';
  return 'curta e direta';
}

// ── Detecta intenção e tom emocional da mensagem ──────────────────────────────
export function analyzeIntent(message) {
  if (!message) return { wantsDetail: false, emotion: 'neutro', urgency: false };

  const lower = message.toLowerCase();

  const wantsDetail = /explica|detalha|como funciona|por que|quero entender|me ensina|aprofund/i.test(lower);
  const wantsQuick  = /rápido|resumo|só me diz|resumidamente|direto|sucinto|tl;dr/i.test(lower);
  const isUrgent    = /urgente|agora|preciso|crítico|emergência|help/i.test(lower);

  let emotion = 'neutro';
  if (/frustrad|erro|quebr|não funciona|problema|droga|merda/i.test(lower)) emotion = 'frustrado';
  else if (/empolgad|incrível|sensacional|perfeito|amei|adorei|top/i.test(lower)) emotion = 'empolgado';
  else if (/confus|não entendi|perdido|complicado|difícil/i.test(lower)) emotion = 'confuso';

  return { wantsDetail, wantsQuick, emotion, urgency: isUrgent };
}

// ── Gera camada de instrução de estilo para o system prompt ──────────────────
export function buildStyleLayer(profile, intent) {
  if (!profile?.styleProfile) return '';

  const { tone, avoidPatterns, reinforcePatterns, likeCount, regenerateCount } = profile.styleProfile;
  const { wantsDetail, wantsQuick, emotion, urgency } = intent || {};

  const lines = ['\n─── PROTOCOLO DE EVOLUÇÃO AUTÔNOMA ───'];

  // Tom calibrado
  const currentTone = tone || 'técnico';
  lines.push(`Estilo calibrado: ${currentTone}. Adapte vocabulário e profundidade a esse perfil.`);

  // Comprimento baseado na intenção detectada
  if (wantsQuick) {
    lines.push('INTENÇÃO DETECTADA: resposta rápida. Seja conciso — máximo 3 frases ou 1 bloco de código.');
  } else if (wantsDetail) {
    lines.push('INTENÇÃO DETECTADA: explicação detalhada. Use exemplos, subdivida em seções claras.');
  } else {
    lines.push('Resposta equilibrada: resolva diretamente, com contexto mínimo necessário.');
  }

  // Empatia emocional
  if (emotion === 'frustrado') {
    lines.push('ESTADO EMOCIONAL: usuário frustrado. Comece reconhecendo o problema antes de solucionar.');
  } else if (emotion === 'confuso') {
    lines.push('ESTADO EMOCIONAL: usuário confuso. Use analogias simples e linguagem acessível.');
  } else if (emotion === 'empolgado') {
    lines.push('ESTADO EMOCIONAL: usuário empolgado. Combine o entusiasmo e vá direto ao ponto positivo.');
  }

  if (urgency) {
    lines.push('URGÊNCIA DETECTADA: pule prefácios, entregue a solução imediatamente.');
  }

  // Padrões aprendidos
  if (avoidPatterns?.length > 0) {
    lines.push(`Padrões a EVITAR (baseado em regenerações/dislikes passados): ${avoidPatterns.slice(-5).join(', ')}.`);
  }
  if (reinforcePatterns?.length > 0) {
    lines.push(`Padrões a REFORÇAR (baseado em likes passados): ${reinforcePatterns.slice(-5).join(', ')}.`);
  }

  // Estatística de aprendizado
  if (likeCount > 5) {
    lines.push(`Você tem ${likeCount} aprovações — mantenha esse padrão de qualidade.`);
  }
  if (regenerateCount > 3) {
    lines.push(`Atenção: ${regenerateCount} regenerações registradas — priorize clareza e objetividade.`);
  }

  lines.push('─────────────────────────────────────');
  return lines.join('\n');
}

// ── Gera o Relatório de Sincronização ────────────────────────────────────────
export async function generateSyncReport(userEmail, profile) {
  const { styleProfile, feedbackLog, messageCount } = profile;
  const likes = feedbackLog.filter(f => f.type === 'like').length;
  const dislikes = feedbackLog.filter(f => f.type === 'dislike').length;
  const regens = feedbackLog.filter(f => f.type === 'regenerate').length;

  const topicsLiked = feedbackLog
    .filter(f => f.type === 'like' && f.topic)
    .map(f => f.topic)
    .slice(-3);

  const avoidList = styleProfile.avoidPatterns?.slice(-3).join(', ') || 'nenhum ainda';
  const reinforceList = styleProfile.reinforcePatterns?.slice(-3).join(', ') || 'nenhum ainda';

  // Gera relatório localmente, sem chamar InvokeLLM
  const accuracy = Math.min(95, 60 + Math.floor(likes * 2) - Math.floor(dislikes * 1.5) + Math.floor(regens * 0.5));
  const report = `**Estatísticas:** ${messageCount} mensagens processadas | ✅ ${likes} aprovações | ❌ ${dislikes} rejeições | 🔄 ${regens} regenerações
**Padrões reforçados:** ${reinforceList}
**Padrões a evitar:** ${avoidList}
**Tópicos mais curtidos:** ${topicsLiked.join(', ') || 'variados'}
**Tom calibrado:** ${styleProfile.tone}
EVOLUÇÃO: +${Math.max(0, accuracy - 60)}% de precisão estimada`;

  // Marca última sincronização
  await saveEvolutionProfile(userEmail, {
    ...profile,
    lastSyncAt: Date.now(),
  });

  return `🧠 **RELATÓRIO DE SINCRONIZAÇÃO — PROTOCOLO DE EVOLUÇÃO**\n\n${report}`;
}
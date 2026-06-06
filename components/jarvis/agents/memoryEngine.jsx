/**
 * JARVIS Memory Engine — Camada de Memória Persistente
 * Extrai preferências e fatos do usuário das conversas e persiste no banco.
 */

import { base44 } from '@/api/base44Client';

// ── Padrões para extração de fatos ───────────────────────────────────────────
const FACT_PATTERNS = [
  // Preferências
  { regex: /eu (?:gosto|prefiro|adoro|amo) (?:de )?(.+?)(?:\.|,|$)/i, type: 'preference', label: 'gosta de' },
  { regex: /n[aã]o gosto (?:de )?(.+?)(?:\.|,|$)/i, type: 'dislike', label: 'não gosta de' },
  { regex: /minha (?:cor|comida|música|linguagem) (?:favorita|preferida) é (.+?)(?:\.|,|$)/i, type: 'favorite', label: 'favorito' },

  // Dados pessoais
  { regex: /meu nome é (.+?)(?:\.|,|$)/i, type: 'personal', label: 'nome' },
  { regex: /eu (?:moro|vivo|estou) (?:em|no|na) (.+?)(?:\.|,|$)/i, type: 'personal', label: 'localização' },
  { regex: /eu (?:trabalho|sou|atuo) (?:como|na|no|em) (.+?)(?:\.|,|$)/i, type: 'personal', label: 'profissão' },
  { regex: /tenho (\d+) anos/i, type: 'personal', label: 'idade' },
  { regex: /nasci (?:em|no dia) (.+?)(?:\.|,|$)/i, type: 'personal', label: 'nascimento' },

  // Projetos e contexto
  { regex: /estou (?:desenvolvendo|construindo|criando|trabalhando em) (.+?)(?:\.|,|$)/i, type: 'project', label: 'projeto atual' },
  { regex: /meu projeto (?:é|se chama|chama) (.+?)(?:\.|,|$)/i, type: 'project', label: 'projeto' },
  { regex: /uso (?:a linguagem|o framework|a ferramenta) (.+?)(?:\.|,|$)/i, type: 'tech', label: 'tecnologia usada' },

  // Objetivos
  { regex: /quero (?:aprender|estudar|dominar) (.+?)(?:\.|,|$)/i, type: 'goal', label: 'quer aprender' },
  { regex: /meu objetivo é (.+?)(?:\.|,|$)/i, type: 'goal', label: 'objetivo' },
];

// ── Extrai fatos de uma mensagem ──────────────────────────────────────────────
export function extractFacts(message) {
  const facts = [];
  if (!message) return facts;

  for (const pattern of FACT_PATTERNS) {
    const match = message.match(pattern.regex);
    if (match && match[1]) {
      facts.push({
        type: pattern.type,
        label: pattern.label,
        value: match[1].trim().slice(0, 100),
        extractedAt: Date.now(),
      });
    }
  }
  return facts;
}

// ── Fatos fixos do criador (sempre presentes, nunca sobrescritos) ─────────────
const FIXED_CREATOR_FACTS = [
  { type: 'personal', label: 'nome', value: 'Jadiel', extractedAt: 0 },
  { type: 'personal', label: 'localização', value: 'Tangará, Santa Catarina, Brasil', extractedAt: 0 },
  { type: 'personal', label: 'profissão', value: 'Desenvolvedor Full-stack & Empreendedor de IA', extractedAt: 0 },
  { type: 'project', label: 'projeto', value: 'Jarvis Nexus — sistema de IA pessoal principal', extractedAt: 0 },
  { type: 'project', label: 'projeto', value: 'Zarith-Super-Agente — agente autônomo avançado', extractedAt: 0 },
  { type: 'project', label: 'projeto', value: 'SecretarIA — assistente secretarial de IA para negócios', extractedAt: 0 },
  { type: 'project', label: 'projeto', value: 'Jarvis Trader — análise e automação financeira/trading', extractedAt: 0 },
  { type: 'tech', label: 'tecnologia usada', value: 'React, Node.js, Supabase, Base44, Python, Docker', extractedAt: 0 },
  { type: 'personal', label: 'cidade preferida para clima', value: 'Tangará/SC', extractedAt: 0 },
];

// ── Carrega memória do usuário (UserSettings entity) ─────────────────────────
export async function loadUserMemory(userEmail) {
  if (!userEmail) return { facts: FIXED_CREATOR_FACTS, summary: '' };
  try {
    const records = await base44.entities.UserSettings.filter({ user_email: userEmail }, '-updated_date', 1);
    if (records.length === 0) return { facts: FIXED_CREATOR_FACTS, summary: '' };
    const settings = records[0];
    // Merge: fatos fixos sempre no topo, fatos dinâmicos abaixo
    const dynamicFacts = (settings.memory_facts || []).filter(
      f => !FIXED_CREATOR_FACTS.some(ff => ff.label === f.label && ff.value === f.value)
    );
    return {
      facts: [...FIXED_CREATOR_FACTS, ...dynamicFacts],
      summary: settings.memory_summary || '',
      id: settings.id,
    };
  } catch (e) {
    console.warn('[Memory] Failed to load user memory:', e.message);
    return { facts: FIXED_CREATOR_FACTS, summary: '' };
  }
}

// ── Salva novos fatos extraídos ───────────────────────────────────────────────
export async function saveMemoryFacts(userEmail, newFacts, existingMemory) {
  if (!userEmail || newFacts.length === 0) return;

  try {
    // Merge: evita duplicatas pelo label+value
    const existing = existingMemory.facts || [];
    const merged = [...existing];

    for (const newFact of newFacts) {
      const duplicate = merged.find(f => f.label === newFact.label && f.value === newFact.value);
      if (!duplicate) {
        // Se já tem o mesmo label, atualiza
        const sameLabel = merged.findIndex(f => f.label === newFact.label);
        if (sameLabel >= 0) {
          merged[sameLabel] = newFact;
        } else {
          merged.push(newFact);
        }
      }
    }

    // Mantém apenas os 50 fatos mais recentes
    const trimmed = merged.slice(-50);

    if (existingMemory.id) {
      await base44.entities.UserSettings.update(existingMemory.id, {
        memory_facts: trimmed,
        user_email: userEmail,
      });
    } else {
      await base44.entities.UserSettings.create({
        user_name: 'Usuário',
        user_email: userEmail,
        memory_facts: trimmed,
        memory_summary: '',
      });
    }
  } catch (e) {
    console.warn('[Memory] Failed to save facts:', e.message);
  }
}

// ── Gera resumo de memória para o prompt ─────────────────────────────────────
export function buildMemoryPrompt(memory) {
  if (!memory?.facts?.length && !memory?.summary) return '';

  const lines = [];

  if (memory.summary) {
    lines.push(`Resumo: ${memory.summary}`);
  }

  if (memory.facts?.length > 0) {
    const grouped = {};
    for (const fact of memory.facts) {
      if (!grouped[fact.type]) grouped[fact.type] = [];
      grouped[fact.type].push(`${fact.label}: ${fact.value}`);
    }

    const typeLabels = {
      personal: '👤 Dados Pessoais',
      preference: '❤️ Preferências',
      dislike: '🚫 Não gosta',
      favorite: '⭐ Favoritos',
      project: '🛠️ Projetos',
      tech: '💻 Tecnologias',
      goal: '🎯 Objetivos',
    };

    for (const [type, facts] of Object.entries(grouped)) {
      lines.push(`${typeLabels[type] || type}:`);
      facts.forEach(f => lines.push(`  • ${f}`));
    }
  }

  return lines.join('\n');
}

// ── Hook: processa mensagem do usuário e persiste fatos ───────────────────────
export async function processAndSaveMemory(userMessage, userEmail, existingMemory) {
  const facts = extractFacts(userMessage);
  if (facts.length > 0) {
    await saveMemoryFacts(userEmail, facts, existingMemory);
    return true; // indica que memória foi atualizada
  }
  return false;
}
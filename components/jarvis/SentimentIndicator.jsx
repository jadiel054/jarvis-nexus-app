import React, { useMemo } from 'react';

const SENTIMENT_PATTERNS = {
  positive: {
    keywords: /(?:obrigad|perfeito|excelente|ótim|incrível|fantástic|maravilhos|parabéns|adorei|amei|😊|😄|🎉|✨|👍|❤️|feliz|alegr|brilhante|sucesso)/i,
    color: 'bg-green-500',
    glow: 'shadow-green-500/40',
    label: 'POSITIVO',
    textColor: 'text-green-400',
    emoji: '😊'
  },
  negative: {
    keywords: /(?:erro|falhou|problema|ruim|péssim|terrível|horrível|triste|raiva|frustr|dificuldade|não consigo|não funciona|😠|😢|😡|💔|irritad|chateado)/i,
    color: 'bg-red-500',
    glow: 'shadow-red-500/40',
    label: 'NEGATIVO',
    textColor: 'text-red-400',
    emoji: '😟'
  },
  question: {
    keywords: /(?:\?|como|o que|quando|onde|por que|quem|qual|me diga|me explica|me ajuda|pode me)/i,
    color: 'bg-yellow-500',
    glow: 'shadow-yellow-500/40',
    label: 'PERGUNTA',
    textColor: 'text-yellow-400',
    emoji: '🤔'
  },
  command: {
    keywords: /(?:faça|crie|gere|escreva|calcule|converta|busque|encontre|mostre|liste|analise|traduza)/i,
    color: 'bg-blue-500',
    glow: 'shadow-blue-500/40',
    label: 'COMANDO',
    textColor: 'text-blue-400',
    emoji: '⚡'
  },
};

export function analyzeSentiment(text) {
  if (!text) return null;
  for (const [type, config] of Object.entries(SENTIMENT_PATTERNS)) {
    if (config.keywords.test(text)) return { type, ...config };
  }
  return null;
}

export default function SentimentIndicator({ text }) {
  const sentiment = useMemo(() => analyzeSentiment(text), [text]);

  if (!sentiment) return null;

  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono ${sentiment.textColor} border border-current/20 opacity-60`}>
      <span>{sentiment.emoji}</span>
      <span>{sentiment.label}</span>
    </div>
  );
}
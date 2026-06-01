// Built-in tools that don't need external APIs

export function detectCalculation(text) {
  // Match expressions like "2+2", "10*5", "quanto é 15/3", "calcule 100-30"
  const cleanText = text.toLowerCase().replace(/quanto\s+[eé]\s*/i, '').replace(/calcul[ea]\s*/i, '');
  const mathMatch = cleanText.match(/[\d]+[\s]*[+\-*/^%][\s]*[\d]+(?:[\s]*[+\-*/^%][\s]*[\d]+)*/);
  if (mathMatch) {
    const expr = mathMatch[0].replace(/\^/g, '**');
    const result = Function(`"use strict"; return (${expr})`)();
    if (!isNaN(result) && isFinite(result)) {
      return { expression: mathMatch[0], result };
    }
  }
  return null;
}

export function detectCurrencyConversion(text) {
  const lower = text.toLowerCase();
  // BRL to USD
  const brlToUsd = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:reais|brl|r\$)\s*(?:em|para|to)\s*(?:d[oó]lar|usd|\$)/);
  if (brlToUsd) {
    const amount = parseFloat(brlToUsd[1].replace(',', '.'));
    const rate = 0.20; // approximate
    return { from: 'BRL', to: 'USD', amount, result: (amount * rate).toFixed(2), rate };
  }
  // BRL to EUR
  const brlToEur = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:reais|brl|r\$)\s*(?:em|para|to)\s*(?:euro|eur|€)/);
  if (brlToEur) {
    const amount = parseFloat(brlToEur[1].replace(',', '.'));
    const rate = 0.18; // approximate
    return { from: 'BRL', to: 'EUR', amount, result: (amount * rate).toFixed(2), rate };
  }
  // USD to BRL
  const usdToBrl = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:d[oó]lar(?:es)?|usd|\$)\s*(?:em|para|to)\s*(?:reais|brl|r\$)/);
  if (usdToBrl) {
    const amount = parseFloat(usdToBrl[1].replace(',', '.'));
    const rate = 5.0;
    return { from: 'USD', to: 'BRL', amount, result: (amount * rate).toFixed(2), rate };
  }
  return null;
}

export function getZodiacSign(birthday) {
  if (!birthday) return null;
  const date = new Date(birthday);
  const day = date.getDate();
  const month = date.getMonth() + 1;

  const signs = [
    { sign: 'Capricórnio', emoji: '♑', start: [1, 1], end: [1, 19] },
    { sign: 'Aquário', emoji: '♒', start: [1, 20], end: [2, 18] },
    { sign: 'Peixes', emoji: '♓', start: [2, 19], end: [3, 20] },
    { sign: 'Áries', emoji: '♈', start: [3, 21], end: [4, 19] },
    { sign: 'Touro', emoji: '♉', start: [4, 20], end: [5, 20] },
    { sign: 'Gêmeos', emoji: '♊', start: [5, 21], end: [6, 20] },
    { sign: 'Câncer', emoji: '♋', start: [6, 21], end: [7, 22] },
    { sign: 'Leão', emoji: '♌', start: [7, 23], end: [8, 22] },
    { sign: 'Virgem', emoji: '♍', start: [8, 23], end: [9, 22] },
    { sign: 'Libra', emoji: '♎', start: [9, 23], end: [10, 22] },
    { sign: 'Escorpião', emoji: '♏', start: [10, 23], end: [11, 21] },
    { sign: 'Sagitário', emoji: '♐', start: [11, 22], end: [12, 21] },
    { sign: 'Capricórnio', emoji: '♑', start: [12, 22], end: [12, 31] },
  ];

  for (const s of signs) {
    const afterStart = month > s.start[0] || (month === s.start[0] && day >= s.start[1]);
    const beforeEnd = month < s.end[0] || (month === s.end[0] && day <= s.end[1]);
    if (afterStart && beforeEnd) {
      return s;
    }
  }
  return signs[0]; // default capricorn
}

const piadas = [
  "Por que o programador largou a namorada? Porque ela tinha muitos bugs no relacionamento! 😄",
  "O que o zero disse pro oito? Bonito cinto! 😂",
  "Por que o livro de matemática se suicidou? Porque tinha muitos problemas! 📚",
  "Qual é o animal mais antigo do mundo? A zebra, porque é em preto e branco! 🦓",
  "O que a impressora disse pro papel? Pode deixar que eu resolvo! 🖨️",
  "Por que o robô foi ao psicólogo? Porque estava tendo um colapso de sistema! 🤖",
  "Qual o cúmulo da tecnologia? O celular cair e quebrar a cara! 📱",
  "O que o café disse pro açúcar? Sem você minha vida é amarga! ☕",
  "Por que o Wi-Fi terminou com o celular? Porque perdeu a conexão! 📶",
  "O que acontece quando um IA conta piada? Todo mundo fica byte-endo! 💻",
];

export function getRandomJoke() {
  return piadas[Math.floor(Math.random() * piadas.length)];
}

export function detectWeatherRequest(text) {
  const lower = text.toLowerCase();
  const patterns = [
    /(?:como\s+(?:est[aá]|vai)\s+o\s+(?:tempo|clima)\s+(?:em|no|na|de)\s+)(.+)/,
    /(?:previs[aã]o\s+(?:do\s+)?tempo\s+(?:em|no|na|de|para)\s+)(.+)/,
    /(?:temperatura\s+(?:em|no|na|de)\s+)(.+)/,
    /(?:clima\s+(?:em|no|na|de)\s+)(.+)/,
  ];
  
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      return match[1].trim().replace(/[?.!]$/, '');
    }
  }

  // Generic weather keywords without city
  if (/(?:tempo|clima|temperatura|previs[aã]o)/.test(lower) && !/(?:em|no|na|de)\s+\w/.test(lower)) {
    return '__default__';
  }
  
  return null;
}

export function isJokeRequest(text) {
  const lower = text.toLowerCase();
  return /(?:piada|piadas|conte.+piada|manda.+piada|faz.+rir|engra[cç]ad|humor)/.test(lower);
}

export function isZodiacRequest(text) {
  const lower = text.toLowerCase();
  return /(?:signo|zod[ií]aco|hor[oó]scopo|astrolog)/.test(lower);
}

export function detectDistanceRequest(text) {
  const lower = text.toLowerCase();
  // Patterns: "distância entre X e Y", "quantos km de X para Y", "como ir de X até Y"
  const patterns = [
    /dist[âa]ncia\s+(?:entre|de)\s+(.+?)\s+(?:e|para|at[eé]|a)\s+(.+?)(?:\?|$)/,
    /quantos?\s+(?:km|kil[oô]metros?)\s+(?:de|entre)\s+(.+?)\s+(?:e|para|at[eé]|a)\s+(.+?)(?:\?|$)/,
    /(?:rota|caminho|como\s+(?:chegar|ir))\s+de\s+(.+?)\s+(?:para|at[eé]|a)\s+(.+?)(?:\?|$)/,
    /de\s+(.+?)\s+(?:para|at[eé])\s+(.+?)\s+(?:quantos?\s+km|dist[âa]ncia)/,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      return { from: match[1].trim(), to: match[2].trim() };
    }
  }
  return null;
}

export function isDistanceRequest(text) {
  const lower = text.toLowerCase();
  return /(?:dist[âa]ncia|quantos\s+km|kil[oô]metro|rota\s+de|como\s+ir\s+de|chegar\s+(?:de|em))/.test(lower);
}
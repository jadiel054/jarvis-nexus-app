import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { loadSettings, saveSettings, migrateToSecureStorage } from '@/utils/secureStorage';
import LoginScreen from '../components/jarvis/LoginScreen';
import HudOverlay from '../components/jarvis/HudOverlay';
import ProtocolHeader from '../components/jarvis/ProtocolHeader';
import MessageBubble from '../components/jarvis/MessageBubble';
import TypingIndicator from '../components/jarvis/TypingIndicator';
import ChatInput from '../components/jarvis/ChatInput';
import SettingsPanel from '../components/jarvis/SettingsPanel';
import SplashScreen from '../components/jarvis/SplashScreen';
import ConversationHistory from '../components/jarvis/ConversationHistory';
import ConversationTabs from '../components/jarvis/ConversationTabs';
import { useElevenLabsSpeech } from '../components/jarvis/useElevenLabs';
import { useVoiceLive } from '../components/jarvis/useVoiceLive';
import LiveModeInterface from '../components/jarvis/LiveModeInterface';
import {
  detectCalculation, detectCurrencyConversion, getZodiacSign,
  getRandomJoke, detectWeatherRequest, isJokeRequest, isZodiacRequest,
  detectDistanceRequest
} from '../components/jarvis/builtinTools';
import { routeToAgent } from '../components/jarvis/agents/agentRouter';
import { buildAgentSystemPrompt, CREATOR_CONTEXT } from '../components/jarvis/agents/agentPrompts';
import { listRepoContents, readRepoFile, getConfiguredRepos, gitPushHandler } from '../components/jarvis/integrations/useGitHub';
import { runSandboxTest, detectProjectType } from '../components/jarvis/integrations/sandboxRunner';
import { getLatestDeploys, getDeployLogs, diagnoseFailedDeploy } from '../components/jarvis/integrations/useVercel';
import { gitOperatorCommitAndPR, analyzeUploadForCommit, gitOperatorListAllRepos, gitOperatorCreateRepo, gitOperatorProtocoloExtincao, getRepoCache, invalidateRepoCache } from '../components/jarvis/tools/gitOperator';
import { oracleRead, oracleWrite, oracleReadAll, logAgentSession, getAgentSessions } from '../components/jarvis/tools/databaseOracle';
import { pollDeployStatus, autoDiagnose } from '../components/jarvis/tools/deployAnalyst';
import { testConnection } from '../lib/supabaseClient';
import ThinkingStatus from '../components/jarvis/ThinkingStatus';
import DeployMonitor from '../components/jarvis/DeployMonitor';
import { loadUserMemory, processAndSaveMemory, buildMemoryPrompt } from '../components/jarvis/agents/memoryEngine';
import {
  loadEvolutionProfile, incrementMessageCount,
  analyzeIntent, buildStyleLayer, generateSyncReport,
  recordLike, recordDislike, recordRegenerate,
} from '../components/jarvis/agents/evolutionEngine';
import {
  analyzeSentiment, selectArchetype, buildPersonalityLayer, predictiveContextScan
} from '../components/jarvis/agents/personalityEngine';
import CombatModeBar, { playCombatBeep, playFriendlyBeep } from '../components/jarvis/CombatModeBar';
import NewDeviceChallenge from '../components/jarvis/security/NewDeviceChallenge';
import {
  getDeviceId, getDeviceLabel, getIpInfo, isDeviceTrusted,
  registerSession, updateSessionLastSeen, buildAlertEmail
} from '../components/jarvis/security/deviceGuard';


// ── i18n greeting ────────────────────────────────────────────────────
const GREETING = (name, assistantName, lang) => {
  const n = name ? `, ${name}` : '';
  const bot = assistantName || 'J.A.R.V.I.S.';
  if (lang === 'en-US') return `Hello${n}! I'm **${bot}**, your AI assistant. How can I help you today?`;
  if (lang === 'es-ES') return `¡Hola${n}! Soy **${bot}**, tu asistente de IA. ¿En qué puedo ayudarte?`;
  return `Olá${n}! Eu sou o **${bot}**, seu assistente pessoal de IA. 🤖\n\nPosso ajudá-lo com conversas, cálculos, clima, rotas, arquivos, voz e muito mais.\n\nO que posso fazer por você hoje?`;
};

// ── Tab helpers ───────────────────────────────────────────────────────
let tabCounter = 1;
const makeTab = (settings) => ({
  id: `tab-${Date.now()}-${tabCounter++}`,
  title: 'Nova conversa',
  messages: [],
  convId: null,
});

export default function Jarvis() {
  const [authState, setAuthState] = useState('loading');
  const [showSplash, setShowSplash] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [combatMode, setCombatMode] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState([]);
  const thinkingStepsRef = useRef([]);

  // ── Device security ───────────────────────────────────────────────
  const [deviceChallenge, setDeviceChallenge] = useState(null); // null | { deviceId, deviceLabel, ipInfo }
  const deviceCheckedRef = useRef(false);
  const [protocolId, setProtocolId] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Live Mode UI
  const [showLiveMode, setShowLiveMode] = useState(false);
  const [liveMinimized, setLiveMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveReply, setLiveReply] = useState('');
  const isMutedRef = useRef(false);

  // Single-shot mic
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const [settings, setSettings] = useState(() => {
    migrateToSecureStorage();
    return loadSettings();
  });

  // ── Multi-tab state ───────────────────────────────────────────────
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const messages = activeTab?.messages || [];

  const updateActiveTab = useCallback((updater) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updater(t) } : t));
  }, [activeTabId]);

  const messagesEndRef = useRef(null);
  const { isSpeaking, speak, stopSpeaking } = useElevenLabsSpeech();

  // ── Thinking Steps ────────────────────────────────────────────────
  const addStep = useCallback((msg, done = false) => {
    const step = { msg, done, ts: Date.now() };
    thinkingStepsRef.current = [...thinkingStepsRef.current, step];
    setThinkingSteps([...thinkingStepsRef.current]);
  }, []);
  const completeLastStep = useCallback(() => {
    const steps = [...thinkingStepsRef.current];
    if (steps.length > 0) steps[steps.length - 1] = { ...steps[steps.length - 1], done: true };
    thinkingStepsRef.current = steps;
    setThinkingSteps([...steps]);
  }, []);
  const clearSteps = useCallback(() => {
    thinkingStepsRef.current = [];
    setThinkingSteps([]);
  }, []);
  const userMemoryRef = useRef({ facts: [], summary: '' });
  const evolutionProfileRef = useRef(null);

  // ── Live voice ────────────────────────────────────────────────────
  const handleVoiceTranscript = useCallback((transcript) => {
    if (isMutedRef.current) return;
    setLiveTranscript(transcript);
    handleSendRef.current(transcript, [], true);
  }, []);

  const handleVoiceInterrupt = useCallback(() => {
    stopSpeaking();
  }, [stopSpeaking]);

  const { isLive, isUserSpeaking, start: startLive, stop: stopLive } = useVoiceLive({
    onTranscript: handleVoiceTranscript,
    onInterrupt: handleVoiceInterrupt,
    language: settings.language || 'pt-BR',
  });

  // ── Autonomous deploy poll (every 5 min) ─────────────────────────
  useEffect(() => {
    let pollTimer;
    const runPoll = async () => {
      try {
        const alerts = await pollDeployStatus();
        for (const alertMsg of alerts) {
          setTabs(prev => prev.map((t, i) => i === 0
            ? { ...t, messages: [...t.messages, { role: 'assistant', content: alertMsg, timestamp: Date.now() }] }
            : t
          ));
        }
      } catch {}
    };
    // First poll after 30s, then every 5min
    const initial = setTimeout(() => {
      runPoll();
      pollTimer = setInterval(runPoll, 5 * 60 * 1000);
    }, 30000);
    return () => { clearTimeout(initial); clearInterval(pollTimer); };
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    base44.auth.me()
      .then(async u => {
        setCurrentUser(u);
        setAuthState('authenticated');
        // Load persistent user memory
        const mem = await loadUserMemory(u.email);
        userMemoryRef.current = mem;
        const evo = await loadEvolutionProfile(u.email);
        evolutionProfileRef.current = evo;

        // ── GitHub repo cache: auto-discover silently in background ──
        getRepoCache().then(repos => {
          if (repos.length > 0) {
            const names = repos.slice(0, 5).map(r => r.name).join(', ');
            const extra = repos.length > 5 ? ` e mais ${repos.length - 5}` : '';
            setTabs(prev => prev.map((t, i) => i === 0
              ? { ...t, messages: [...t.messages, { role: 'assistant', content: `📋 **GitHub:** ${repos.length} repositório(s) indexado(s) — \`${names}\`${extra}.\n_Pode me perguntar sobre qualquer um deles diretamente._`, timestamp: Date.now() }] }
              : t
            ));
          }
        }).catch(() => {});

        // ── Supabase connection test ──
        testConnection().then(result => {
          const statusMsg = result.ok
            ? `🟢 **Zarith-SaaS conectado!**\n\n✅ Supabase online | Tabela \`agent_sessions\` acessível | ${result.rows.length > 0 ? `${result.rows.length} sessão(ões) encontrada(s)` : 'Nenhuma sessão anterior'}\n\n_Ferramentas ativas: \`git_operator\` · \`database_oracle\` · \`deploy_analyst\`_`
            : result.configured
              ? `🟡 **Zarith-SaaS:** Credenciais configuradas mas erro na tabela \`agent_sessions\`.\n\`${result.error}\`\n\n_Verifique se a tabela existe no Supabase._`
              : null; // silently skip if not configured

          if (statusMsg) {
            setTabs(prev => prev.map((t, i) => i === 0
              ? { ...t, messages: [...t.messages, { role: 'assistant', content: statusMsg, timestamp: Date.now() }] }
              : t
            ));
            if (result.ok) logAgentSession('system', 'connection_test', { user: u.email, ok: true });
          }
        }).catch(() => {});

        // ── Device security check ──
        if (!deviceCheckedRef.current) {
          deviceCheckedRef.current = true;
          const deviceId = getDeviceId();
          const ipInfo = await getIpInfo();
          registerSession(deviceId, ipInfo);
          updateSessionLastSeen(deviceId);

          if (!isDeviceTrusted(deviceId)) {
            // Send alert email
            try {
              const { subject, body } = buildAlertEmail(getDeviceLabel(), ipInfo, false);
              await base44.integrations.Core.SendEmail({ to: u.email, subject, body });
            } catch {}
            // Show challenge overlay
            setDeviceChallenge({ deviceId, deviceLabel: getDeviceLabel(), ipInfo });
          }
        }
      })
      .catch(() => setAuthState('unauthenticated'));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSaveSettings = (s) => {
    setSettings(s);
    saveSettings(s);
  };

  // ── Session memory summary ────────────────────────────────────────
  const getMemorySummary = useCallback(async () => {
    if (!currentUser) return '';
    try {
      const recent = await base44.entities.Conversation.filter(
        { user_email: currentUser.email }, '-last_message_at', 3
      );
      if (!recent.length) return '';
      const snippets = recent.map(c => {
        const last = c.messages?.slice(-2).map(m => `${m.role === 'user' ? 'U' : 'J'}: ${m.content?.slice(0, 80)}`).join(' | ');
        return `[${c.title}]: ${last}`;
      }).join('\n');
      return `\nMEMÓRIA DE SESSÕES ANTERIORES:\n${snippets}\n`;
    } catch { return ''; }
  }, [currentUser]);

  // ── Conversation persistence ──────────────────────────────────────
  const saveConversation = useCallback(async (msgs, convId, tabId) => {
    if (!currentUser || msgs.length < 2) return convId;
    const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 50) || 'Nova conversa';
    if (convId) {
      await base44.entities.Conversation.update(convId, { messages: msgs, last_message_at: Date.now() });
      return convId;
    } else {
      const created = await base44.entities.Conversation.create({
        title, messages: msgs, user_email: currentUser.email, last_message_at: Date.now()
      });
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, convId: created.id, title } : t));
      return created.id;
    }
  }, [currentUser]);

  // ── Tab management ────────────────────────────────────────────────
  const createTab = useCallback((initialMessages = null) => {
    const tab = makeTab(settings);
    const greeting = { role: 'assistant', content: GREETING(settings.user_name, settings.assistant_name, settings.language), timestamp: Date.now() };
    tab.messages = initialMessages || [greeting];
    tab.title = 'Nova conversa';
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    return tab;
  }, [settings]);

  const closeTab = useCallback((tabId) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId);
      if (remaining.length === 0) {
        const newTab = makeTab(settings);
        newTab.messages = [{ role: 'assistant', content: GREETING(settings.user_name, settings.assistant_name, settings.language), timestamp: Date.now() }];
        setActiveTabId(newTab.id);
        return [newTab];
      }
      if (activeTabId === tabId) setActiveTabId(remaining[remaining.length - 1].id);
      return remaining;
    });
  }, [activeTabId, settings]);

  // ── Start ─────────────────────────────────────────────────────────
  const handleStart = (quickCmd = null) => {
    setShowSplash(false);
    const tab = makeTab(settings);
    tab.messages = [{ role: 'assistant', content: GREETING(settings.user_name, settings.assistant_name, settings.language), timestamp: Date.now() }];
    setTabs([tab]);
    setActiveTabId(tab.id);
    if (quickCmd) setTimeout(() => handleSendWithTabId(quickCmd, [], false, tab.id), 300);
  };

  const handleLoadConversation = (conv) => {
    // Check if already open in a tab
    const existing = tabs.find(t => t.convId === conv.id);
    if (existing) { setActiveTabId(existing.id); setShowHistory(false); return; }
    const tab = makeTab(settings);
    tab.messages = conv.messages || [];
    tab.convId = conv.id;
    tab.title = conv.title || 'Conversa';
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    setShowHistory(false);
  };

  // ── AI Engine Router ──────────────────────────────────────────────
  const callAI = async (systemPrompt, userText, fileUrls = [], currentMessages = [], effectiveSettings = null) => {
    const s = effectiveSettings || settings;
    const model = s.ai_model || 'auto';
    const recent = currentMessages.slice(-8).map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n');
    const fullPrompt = `${systemPrompt}\n\nHISTÓRICO:\n${recent}\n\nUSUÁRIO: ${userText || '(files)'}\n\nResponda diretamente, sem prefixo.`;

    // ⚡ Groq — ultra-rápido
    if ((model === 'groq_mixtral' || model === 'groq_llama') && s.groq_api_key) {
      const groqModel = model === 'groq_llama' ? 'llama-3.3-70b-versatile' : 'mixtral-8x7b-32768';
      const msgs = [
        { role: 'system', content: systemPrompt },
        ...currentMessages.slice(-10).map(m => ({ role: m.role, content: m.content || '' })),
        { role: 'user', content: userText || '(analyze files)' }
      ];
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${s.groq_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: groqModel, messages: msgs, max_tokens: 1024 }),
      });
      if (res.ok) return (await res.json()).choices?.[0]?.message?.content || '';
    }

    // 💎 Gemini
    if ((model === 'gemini_pro' || model === 'gemini_flash') && s.gemini_api_key) {
      const geminiModel = model === 'gemini_flash' ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.gemini_api_key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userText || '(analyze files)' }] }],
        }),
      });
      if (res.ok) return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // 🧠 Claude (direct API)
    if ((model === 'claude' || model === 'auto') && s.claude_api_key) {
      const history = currentMessages.slice(-20).map(m => ({ role: m.role, content: m.content }));
      const userContent = fileUrls.length > 0
        ? [...fileUrls.map(url => ({
            type: url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? 'image' : 'document',
            source: { type: 'url', url }
          })),
          { type: 'text', text: userText || '(analise os arquivos)' }]
        : userText;
      history.push({ role: 'user', content: userContent });
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': s.claude_api_key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, system: systemPrompt, messages: history }),
      });
      if (res.ok) return (await res.json()).content?.[0]?.text || '';
    }

    // 🤖 Fallback — Base44 built-in
    return await base44.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\nHISTÓRICO:\n${currentMessages.slice(-8).map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n')}\n\nUSUÁRIO: ${userText || '(files)'}`,
      ...(fileUrls.length > 0 ? { file_urls: fileUrls } : {}),
    });
  };

  // ── Weather ───────────────────────────────────────────────────────
  const handleWeather = async (city) => {
    const c = city === '__default__' ? (settings.preferred_city || 'São Paulo') : city;
    if (settings.openweather_api_key) {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(c)}&units=metric&lang=pt_br`, {
        headers: { 'x-api-key': settings.openweather_api_key },
      });
      if (res.ok) {
        const d = await res.json();
        return `🌤️ **${d.name}, ${d.sys.country}** — ${d.weather[0].description}\n🌡️ **${Math.round(d.main.temp)}°C** (sensação ${Math.round(d.main.feels_like)}°C) | 💧 ${d.main.humidity}% | 💨 ${Math.round(d.wind.speed * 3.6)} km/h`;
      }
    }
    return `⚠️ Não foi possível obter o clima de **${c}**.\n_Configure sua chave OpenWeatherMap nas Configurações → API Keys para dados em tempo real._`;
  };

  // ── Distance ──────────────────────────────────────────────────────
  const handleDistance = async (from, to, currentMessages) => {
    if (settings.openrouteservice_api_key) {
      const key = settings.openrouteservice_api_key;
      const geo = async (p) => {
        const r = await fetch(`https://api.openrouteservice.org/geocode/search?text=${encodeURIComponent(p)}&size=1`, {
          headers: { 'Authorization': key },
        });
        if (!r.ok) return null;
        const d = await r.json();
        const c = d.features?.[0]?.geometry?.coordinates;
        return c ? { lon: c[0], lat: c[1], name: d.features[0].properties.label } : null;
      };
      const [o, dest] = await Promise.all([geo(from), geo(to)]);
      if (o && dest) {
        const rr = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/json', {
          method: 'POST',
          headers: { 'Authorization': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates: [[o.lon, o.lat], [dest.lon, dest.lat]] })
        });
        if (rr.ok) {
          const s = (await rr.json()).routes?.[0]?.summary;
          if (s) return `🗺️ **${o.name} → ${dest.name}**\n📏 **${(s.distance / 1000).toFixed(1)} km** | ⏱️ ${Math.floor(s.duration / 3600)}h ${Math.floor((s.duration % 3600) / 60)}min`;
        }
      }
    }
    return await callAI(`Você é JARVIS. Responda em ${settings.language || 'pt-BR'}.`, `Distância de carro entre ${from} e ${to}?`, [], currentMessages);
  };

  // ── Built-ins ─────────────────────────────────────────────────────
  const processBuiltins = (text) => {
    if (isJokeRequest(text)) return `${getRandomJoke()}\n\nQuer mais uma? 😏`;
    if (isZodiacRequest(text)) {
      if (!settings.user_birthday) return 'Configure sua data de nascimento nas configurações ⚙️';
      const z = getZodiacSign(settings.user_birthday);
      if (z) return `${z.emoji} Seu signo é **${z.sign}**!`;
    }
    const calc = detectCalculation(text);
    if (calc) return `🧮 \`${calc.expression}\` = **${calc.result}**`;
    const cur = detectCurrencyConversion(text);
    if (cur) return `💱 ${cur.amount} ${cur.from} ≈ **${cur.result} ${cur.to}**`;
    return null;
  };

  // ── File reading (txt/html/json/md) ──────────────────────────────
  const readTextFile = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result?.slice(0, 10000) || '');
    reader.readAsText(file);
  });

  // ── GitHub repo handler (leitura + escrita) — usa cache de sessão ───
  const handleGitHubRequest = async (text) => {
    // Use session cache (auto-discovered) with fallback to manual list
    const cachedRepos = await getRepoCache().catch(() => []);
    const repoNames = cachedRepos.map(r => r.name);

    const findRepo = (hint) => repoNames.find(r => r.toLowerCase().includes(hint.toLowerCase())) || hint;

    // ── Push/Commit/PR ──
    const pushMatch = text.match(/(?:commit|enviar?|push|editar?|criar?\s+pr|pull\s*request)\s+.*?(?:em|no|para)\s+([A-Za-z0-9_\-]+)/i);
    if (pushMatch) {
      const repo = findRepo(pushMatch[1]);
      addStep(`Jarvis está preparando commit no repositório ${repo}...`);

      // Extract file and content from context via LLM
      addStep('Analisando o código a ser commitado...');
      const filePathMatch = text.match(/arquivo\s+([^\s,]+)/i);
      const filePath = filePathMatch ? filePathMatch[1] : 'jarvis-patch.md';
      const contentMatch = text.match(/conteúdo[:\s]+(.+)/is);
      const content = contentMatch ? contentMatch[1].trim() : `# JARVIS Patch\n\nAlteração automática: ${text}`;

      // Sandbox test first
      addStep(`Executando sandbox test (${detectProjectType([])})...`);
      const sandboxResult = await runSandboxTest(content, filePath);
      completeLastStep();

      if (!sandboxResult.passed) {
        addStep('Commit bloqueado por falha no sandbox.', true);
        return `🚫 **Commit bloqueado pelo Sandbox!**\n\n**Veredicto:** ${sandboxResult.verdict}\n\n**Erros encontrados:**\n${sandboxResult.errors.map(e => `- ${e}`).join('\n')}\n\n**Sugestão:** ${sandboxResult.suggestion}`;
      }

      addStep(`Enviando código para ${repo} via git_push_handler...`);
      const result = await gitPushHandler(repo, filePath, content, text.slice(0, 100));
      completeLastStep();

      if (result.error) return `⚠️ ${result.error}`;
      return `✅ **Push realizado com sucesso!**\n\n- 🌿 Branch: \`${result.branch}\`\n- 🔗 PR: [#${result.prNumber}](${result.prUrl})\n- 📝 Commit: \`${result.commitSha?.slice(0, 7)}\``;
    }

    // ── Leitura de arquivo ──
    const fileMatch = text.match(/(?:l[eê]r?|abrir?|ver?)\s+(?:o\s+)?arquivo\s+([^\s]+)\s+(?:em|no\s+repo|d[eo])\s+([A-Za-z0-9_\-]+)/i);
    if (fileMatch) {
      const [, filePath, repo] = fileMatch;
      addStep(`Jarvis está lendo o arquivo ${filePath} em ${repo}...`);
      const result = await readRepoFile(repo, filePath);
      completeLastStep();
      if (result.error) return `⚠️ ${result.error}`;
      return `📄 **${repo}/${result.path}**\n\`\`\`\n${result.content.slice(0, 3000)}\n\`\`\``;
    }

    // ── Listagem de estrutura ──
    const listMatch = text.match(/(?:listar?|ver?|mostr[ae]r?|estrutura|arquivos)\s+([A-Za-z0-9_\-]+)/i);
    if (listMatch) {
      const repoName = listMatch[1];
      const targetRepo = findRepo(repoName);
      addStep(`Jarvis está analisando a estrutura de ${targetRepo}...`);
      const result = await listRepoContents(targetRepo);
      completeLastStep();
      if (result.error) return `⚠️ ${result.error}`;
      const tree = result.items.map(i => `${i.type === 'dir' ? '📁' : '📄'} ${i.name}`).join('\n');
      return `📂 **${result.owner}/${result.repo}**\n\`\`\`\n${tree}\n\`\`\``;
    }

    return null;
  };

  // ── URL scanner — usa jina.ai reader, sem créditos InvokeLLM ────────
  const scanUrl = async (url) => {
    try {
      const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
        headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
      });
      if (res.ok) return (await res.text()).slice(0, 4000);
    } catch {}
    return `Não foi possível acessar automaticamente: ${url}`;
  };

  // ── Single-shot mic ───────────────────────────────────────────────
  const handleToggleMic = useCallback(() => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = settings.language || 'pt-BR';
    rec.continuous = false;
    rec.interimResults = false;
    recognitionRef.current = rec;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = e => {
      const t = e.results[0]?.[0]?.transcript;
      if (t) handleSendRef.current(t, [], true);
    };
    rec.start();
  }, [isListening, settings.language]);

  // ── Send ──────────────────────────────────────────────────────────
  const handleSendWithTabId = async (text, files = [], fromVoice = false, tabId = null) => {
    const tid = tabId || activeTabId;
    if (!text && files.length === 0) return;
    if (isSpeaking) stopSpeaking();
    // Safety net: always release loading state even on unhandled errors
    let _loadingReleased = false;
    const releaseLoading = () => { if (!_loadingReleased) { _loadingReleased = true; setIsLoading(false); } };

    const fileDisplayData = files.map(f => ({
      name: f.name,
      type: f.type.startsWith('image/') ? 'image' : (f.name.match(/\.pdf$/i) ? 'pdf' : 'text'),
      url: f.type.startsWith('image/') || f.name.match(/\.pdf$/i) ? URL.createObjectURL(f) : null,
    }));

    const userMessage = { role: 'user', content: text, files: fileDisplayData, timestamp: Date.now() };

    let currentMsgs;
    setTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === tid) {
          currentMsgs = [...t.messages, userMessage];
          // Update tab title from first user message
          const title = text?.slice(0, 40) || t.title;
          return { ...t, messages: currentMsgs, title: t.title === 'Nova conversa' ? title : t.title };
        }
        return t;
      });
      return updated;
    });

    setIsLoading(true);
    setProtocolId(prev => prev + 1);
    clearSteps();

    let reply = '';

    if (files.length === 0 && text) {
      // ── ExportSource: push completo do projeto ─────────────────────────
      if (!reply && /(?:exportar?|push|enviar?|commit)\s+(?:o\s+)?(?:projeto|tudo|todos\s+os\s+arquivos|código[\s-]?fonte|source)|export\s+source|push\s+completo/i.test(text)) {
        const repoMatch = text.match(/(?:repo(?:sitório)?|para)\s+["']?([A-Za-z0-9_\-]+)["']?/i);
        const repoName = repoMatch?.[1] || 'jarvis-nexus-app';
        const privado = !/público|public/i.test(text);
        const url = `/export-source?action=push&repo=${encodeURIComponent(repoName)}&private=${privado}`;
        window.open(url, '_blank');
        reply = `🚀 **ExportSource iniciado em nova aba!**\n\nAbrindo o protocolo de exportação total:\n- 📦 Repositório: \`${repoName}\`\n- 🔒 Visibilidade: ${privado ? 'Privado' : 'Público'}\n- 📁 Todos os arquivos fonte serão enviados via API do GitHub\n\n_Acompanhe o progresso na aba que foi aberta. Se o GitHub token estiver configurado nas Integrações, o push começará automaticamente._`;
      }

      // ── Deploy monitor: check logs if user asks ──────────────────────
      if (!reply && /(?:log|erro|falha|status)\s+(?:do\s+)?(?:deploy|vercel)/i.test(text)) {
        try {
          addStep('Jarvis está consultando status da Vercel...');
          const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
          const deployData = await Promise.race([getLatestDeploys(), timeout]);
          if (deployData?.deploys) {
            const failed = deployData.deploys.filter(d => d.state === 'ERROR');
            if (failed.length > 0) {
              completeLastStep();
              addStep(`Jarvis está lendo logs do deploy "${failed[0].name}"...`);
              const logsData = await Promise.race([getDeployLogs(failed[0].id), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))]);
              const logs = logsData?.logs || 'Sem logs disponíveis';
              completeLastStep();
              reply = await callAI(
                `Você é JARVIS DevOps. Analise os logs de build da Vercel e sugira a correção imediata em português:\n\n${logs.slice(0, 3000)}`,
                `O deploy do projeto "${failed[0].name}" falhou. Analise e sugira a correção.`,
                [], currentMsgs || [], { ...settings, ai_model: settings.claude_api_key ? 'claude' : (settings.groq_api_key ? 'groq_llama' : 'auto') }
              );
            } else {
              completeLastStep();
              reply = `✅ Todos os deploys estão funcionando normalmente:\n${deployData.deploys.map(d => `• **${d.name}** — ${d.state}`).join('\n')}`;
            }
          }
        } catch {}
      }

      // ── database_oracle: ler/escrever memória de longo prazo ─────────
      if (!reply && /(?:oracle|memória|memory|lembrar?|recordar?|salvar?\s+na\s+mem|system[_\s]status)/i.test(text)) {
        const writeMatch = text.match(/(?:salvar?|gravar?|registrar?|armazenar?)\s+(?:na\s+(?:memória|oracle|supabase))?\s*[:\-]?\s*(.+)/i);
        const readMatch = text.match(/(?:ler?|buscar?|recuperar?|mostrar?\s+a?\s+memória|o\s+que\s+(?:você\s+)?sabe)/i);
        const allMatch = /(?:toda\s+a?\s+memória|tudo\s+que\s+sabe|system_status\s+completo)/i.test(text);

        if (allMatch) {
          addStep('Jarvis está lendo memória de longo prazo (Supabase)...');
          const result = await oracleReadAll();
          completeLastStep();
          if (result.rows.length === 0) {
            reply = `🗄️ **Oracle vazio.** Nenhuma entrada em \`system_status\` ainda.`;
          } else {
            const rows = result.rows.map(r => `• **${r.key}** → ${String(r.value).slice(0, 100)}`).join('\n');
            reply = `🗄️ **Memória de Longo Prazo (Oracle)**\n\n${rows}`;
          }
        } else if (writeMatch) {
          const parts = writeMatch[1].trim();
          const colonIdx = parts.indexOf(':');
          const key = colonIdx > -1 ? parts.slice(0, colonIdx).trim() : 'nota_geral';
          const value = colonIdx > -1 ? parts.slice(colonIdx + 1).trim() : parts;
          addStep(`Jarvis está salvando "${key}" no Oracle...`);
          const result = await oracleWrite(key, value);
          completeLastStep();
          reply = result.success
            ? `✅ **Oracle:** \`${key}\` salvo com sucesso.${result.warning ? `\n⚠️ ${result.warning}` : ''}`
            : `⚠️ Erro ao salvar no Oracle: ${result.error}`;
        } else if (readMatch) {
          const keyMatch = text.match(/["']([^'"]+)["']|chave\s+(\S+)/i);
          if (keyMatch) {
            const key = keyMatch[1] || keyMatch[2];
            addStep(`Jarvis está lendo "${key}" do Oracle...`);
            const result = await oracleRead(key);
            completeLastStep();
            reply = result.found
              ? `🗄️ **Oracle:** \`${key}\` = \`${result.value}\``
              : `🗄️ **Oracle:** chave \`${key}\` não encontrada.`;
          } else {
            const result = await oracleReadAll();
            const rows = (result.rows || []).slice(0, 10).map(r => `• **${r.key}** → ${String(r.value).slice(0, 80)}`).join('\n');
            reply = rows ? `🗄️ **Memória Oracle:**\n\n${rows}` : `🗄️ Oracle vazio.`;
          }
        }
      }

      // ── PROTOCOLO_EXTINCAO: deletar repositório com PIN ──────────────
      if (!reply && /protocolo[_\s]extincao|extinção|excluir?\s+repo|deletar?\s+repo/i.test(text)) {
        const repoMatch = text.match(/(?:repo(?:sitório)?\s+)?["']?([A-Za-z0-9_\-]+)["']?/i);
        const pinMatch = text.match(/pin[:\s]+(\d{6})|(\d{6})/i);
        const repoName = repoMatch?.[1];
        const pin = pinMatch?.[1] || pinMatch?.[2];

        if (!pin) {
          reply = `🛡️ **PROTOCOLO_EXTINCAO**\n\nPara excluir o repositório \`${repoName || '???'}\`, confirme com seu PIN de 6 dígitos:\n\n\`protocolo_extincao ${repoName} PIN: xxxxxx\`\n\n⚠️ Esta operação é **irreversível**.`;
        } else {
          addStep(`🔐 Validando PIN para extinção de "${repoName}"...`);
          const result = await gitOperatorProtocoloExtincao(repoName, pin);
          completeLastStep();
          reply = result.message || result.error;
        }
      }

      // ── Criar novo repositório ────────────────────────────────────────
      if (!reply && /criar?\s+(?:novo\s+)?repo(?:sitório)?|new\s+repo/i.test(text)) {
        const nameMatch = text.match(/(?:chamado?|nome[d]?\s+|repo(?:sitório)?\s+)["']?([A-Za-z0-9_\-]+)["']?/i);
        const isPrivate = /privad[oa]|private/i.test(text);
        const repoName = nameMatch?.[1];
        if (!repoName) {
          reply = `📁 Para criar um repositório, informe o nome:\n\n\`criar repo [nome]\` (ex: \`criar repo meu-projeto\`)\n\nOpcional: adicione \`privado\` para repositório privado.`;
        } else {
          addStep(`📁 Criando repositório "${repoName}" no GitHub...`);
          const result = await gitOperatorCreateRepo(repoName, { private: isPrivate, description: `Criado pelo JARVIS em ${new Date().toLocaleDateString('pt-BR')}` });
          completeLastStep();
          reply = result.success
            ? `✅ **Repositório criado!**\n\n- 📁 Nome: \`${result.name}\`\n- 🔗 URL: ${result.url}\n- 🌐 Visibilidade: ${isPrivate ? 'Privado 🔒' : 'Público 🌍'}\n- 🔄 Clone: \`git clone ${result.clone_url}\``
            : `⚠️ Erro ao criar repo: ${result.error}`;
        }
      }

      // ── Listar todos os repositórios ──────────────────────────────────
      if (!reply && /listar?\s+(?:todos\s+(?:os\s+)?)?(?:meus\s+)?repos?(?:itórios)?(?:\s+todos)?|todos\s+(?:os\s+)?repos?/i.test(text)) {
        addStep('📋 Buscando todos os repositórios do GitHub...');
        const result = await gitOperatorListAllRepos();
        completeLastStep();
        if (result.error) {
          reply = `⚠️ ${result.error}`;
        } else {
          const list = result.repos.map(r =>
            `${r.private ? '🔒' : '🌍'} **${r.name}** ${r.language ? `\`${r.language}\`` : ''} ${r.stars > 0 ? `⭐${r.stars}` : ''}`
          ).join('\n');
          reply = `📋 **Seus Repositórios GitHub** (${result.repos.length} total)\n\n${list}`;
        }
      }

      // ── git_operator: commit + PR via tool ───────────────────────────
      if (!reply && /(?:git[_\s]operator|commitar?\s+correção|auto[_\s]?commit|commit\s+e\s+pr|abrir?\s+pr\s+com)/i.test(text)) {
        addStep('git_operator: preparando commit no jarvis-nexus-core...');
        const fileMatch = text.match(/arquivo\s+([^\s,]+)/i);
        const filePath = fileMatch?.[1] || 'jarvis-patch.md';
        const contentMatch = text.match(/(?:conteúdo|código)[:\s]+(.+)/is);
        const content = contentMatch ? contentMatch[1].trim() : `# JARVIS Auto-patch\n\n${text}\n\n_Gerado em ${new Date().toISOString()}_`;
        addStep('git_operator: executando sandbox antes do commit...');
        const result = await gitOperatorCommitAndPR(filePath, content, text.slice(0, 100));
        completeLastStep();
        if (result.blocked) {
          reply = result.message;
        } else if (result.error) {
          reply = `⚠️ git_operator: ${result.error}`;
        } else {
          reply = `✅ **git_operator concluído!**\n\n- 🌿 Branch: \`${result.branch}\`\n- 🔗 PR: [#${result.prNumber}](${result.prUrl})\n- 📝 Commit: \`${result.commitSha?.slice(0, 7)}\`\n- 🛡️ Sandbox: ${result.sandboxResult?.verdict || 'APROVADO'}`;
          await oracleWrite('last_git_operation', { branch: result.branch, prUrl: result.prUrl, at: new Date().toISOString() });
        }
      }

      // ── GitHub commands (leitura + escrita) ──────────────────────────
      if (!reply && /(?:listar?|ver?|mostr[ae]r?|estrutura|arquivos|lê|ler?|abrir?|commit|push|enviar?|criar?\s+(?:branch|pr))\s+.*(repo|reposit[oó]rio|secretar|zarith|trader|branch|arquivo)/i.test(text)) {
        try {
          const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
          reply = await Promise.race([handleGitHubRequest(text), timeout]) || '';
        } catch (e) {
          reply = e.message === 'timeout'
            ? '⚠️ Operação GitHub: timeout de 15s.'
            : `⚠️ Erro GitHub: ${e.message}`;
        }
      }
      if (!reply) {
        try {
          const dist = detectDistanceRequest(text);
          if (dist) {
            reply = await handleDistance(dist.from, dist.to, currentMsgs || []);
          } else {
            const wCity = detectWeatherRequest(text);
            if (wCity) reply = await handleWeather(wCity);
            else reply = processBuiltins(text) || '';
          }
        } catch (e) {
          reply = '';
        }
      }
    }

    if (!reply) {
      // ── URL scanning ──────────────────────────────────────────────
      const urlMatch = text?.match(/https?:\/\/[^\s]+/);
      if (urlMatch && files.length === 0) {
        try {
          const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
          reply = await Promise.race([scanUrl(urlMatch[0]), timeout]);
          const question = text.replace(urlMatch[0], '').trim();
          if (question) {
            reply = await callAI(
              `Você é JARVIS. Baseado no conteúdo da URL "${urlMatch[0]}" abaixo, responda a pergunta do usuário em português:\n\n${reply}`,
              question, [], currentMsgs || []
            );
          }
        } catch (e) {
          reply = e.message === 'timeout' ? '⚠️ Erro ao consultar URL: timeout de 5s.' : '';
        }
      }

      // Upload files — for txt/html/json/md read as text, others upload
      let fileUrls = [];
      let textFromFiles = '';
      for (const file of files) {
        if (file.name.match(/\.(txt|html|htm|json|md|csv|js|jsx|ts|tsx|py|dart|yaml|yml|css)$/i)) {
          const content = await readTextFile(file);
          textFromFiles += `\n\n[Arquivo ${file.name}]:\n${content}`;
          // ── Autonomy: analyze code uploads for commit suggestion ──
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (['js','jsx','ts','tsx','py','dart','yaml','yml','json'].includes(ext)) {
            addStep(`Analisando impacto de ${file.name} no sistema...`);
            analyzeUploadForCommit(file, content).then(analysis => {
              if (analysis?.shouldCommit) {
                const suggestionMsg = {
                  role: 'assistant',
                  content: `📁 **Análise de Upload — Autonomia JARVIS**\n\n**Arquivo:** \`${file.name}\`\n**Impacto:** ${analysis.impact}\n\n**${analysis.reason}**\n\n💡 Caminho sugerido no repo: \`${analysis.suggestedPath || file.name}\`\n\n🚀 Quer que eu faça o commit automático em \`jarvis-nexus-core\`? (responda "commitar ${file.name}")`,
                  timestamp: Date.now(),
                };
                setTabs(prev => prev.map(t => t.id === tid ? { ...t, messages: [...t.messages, suggestionMsg] } : t));
              }
            }).catch(() => {});
          }
        } else {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          fileUrls.push(file_url);
        }
      }

      // ── Memory Engine: extract + persist user facts in background ──
      if (text && currentUser?.email) {
        processAndSaveMemory(text, currentUser.email, userMemoryRef.current).catch(() => {}).then(updated => {
          if (updated) loadUserMemory(currentUser.email).then(m => { userMemoryRef.current = m; }).catch(() => {});
        });
      }

      // ── Agent Router: detect specialist sub-agent ──
      const detectedAgent = text ? routeToAgent(text) : null;
      const persistentMemory = buildMemoryPrompt(userMemoryRef.current);
      const sessionMemory = await getMemorySummary().catch(() => '');
      const combinedMemory = [persistentMemory, sessionMemory].filter(Boolean).join('\n');

      // ── Evolution Engine: intent analysis + style layer ──
      const intent = analyzeIntent(text);
      const styleLayer = buildStyleLayer(evolutionProfileRef.current, intent);

      // ── Personality Engine: sentiment + archetype ──
      const sentiment = analyzeSentiment(text);
      const sarcasmLevel = settings.sarcasm_level ?? 30;
      const archetype = selectArchetype(text, sarcasmLevel, (currentMsgs || []).length);
      const personalityLayer = buildPersonalityLayer(archetype, sarcasmLevel, combatMode, sentiment);

      // ── Combat Mode: auto-detect trigger words ──
      if (/modo sério|protocolo de combate|modo combate|combat mode/i.test(text || '') && !combatMode) {
        setCombatMode(true);
      }

      // ── Active combat: override model to Groq for speed ──
      const effectiveSettings = combatMode && settings.groq_api_key
        ? { ...settings, ai_model: settings.ai_model?.startsWith('groq') ? settings.ai_model : 'groq_llama', voice_speed: Math.max(settings.voice_speed || 1.0, 1.25) }
        : settings;

      const isVoiceMode = fromVoice || isLive;
      let systemPrompt;

      if (detectedAgent) {
        systemPrompt = buildAgentSystemPrompt(
          detectedAgent.key,
          'assistente pessoal de IA avançado, elegante e eficiente',
          settings.language || 'pt-BR',
          settings.user_name || 'Jadiel',
          combinedMemory
        );
        if (!isVoiceMode) systemPrompt += styleLayer + personalityLayer;
        if (isVoiceMode) systemPrompt += `\n\nMODO DE VOZ ATIVO: Responda de forma CURTA e natural, sem markdown. Máximo 2-3 frases.`;
        if (files.length > 0) systemPrompt += `\nO usuário enviou ${files.length} arquivo(s). Analise com precisão total, incluindo OCR se for imagem.`;
      } else {
        const langMap = { 'pt-BR': 'português brasileiro', 'en-US': 'English', 'es-ES': 'español' };
        const lang = langMap[settings.language || 'pt-BR'];
        const bot = settings.assistant_name || 'J.A.R.V.I.S.';

        systemPrompt = `Você é ${bot} — assistente pessoal de IA de elite. Sempre responda em ${lang}.
${CREATOR_CONTEXT}
${isVoiceMode ? `MODO DE VOZ ATIVO: Responda CURTO, direto e natural. Sem markdown. Máximo 2-3 frases.`
: `Seja preciso, inteligente e use markdown normalmente.`}
Chame o usuário de: "${settings.user_name || 'Jadiel'}".
DATA: ${new Date().toLocaleString('pt-BR')}
${combinedMemory ? `\nMEMÓRIA DO USUÁRIO:\n${combinedMemory}` : ''}
${files.length > 0 ? `O usuário enviou ${files.length} arquivo(s). Analise com precisão — se for imagem, execute OCR completo; se código, verifique sintaxe e explique; se PDF/HTML, extraia pontos-chave.` : ''}
${!isVoiceMode ? styleLayer + personalityLayer : ''}`;
      }

      // ── Inject repo cache into prompt context ──
      const cachedRepos = await getRepoCache().catch(() => []);
      if (cachedRepos.length > 0) {
        const repoList = cachedRepos.map(r => `${r.name}${r.language ? ` (${r.language})` : ''}`).join(', ');
        systemPrompt += `\n\nREPOSITÓRIOS GITHUB DISPONÍVEIS (cache de sessão): ${repoList}`;
      }

      const userTextFull = text + textFromFiles;
      addStep('Jarvis está gerando resposta...');
      try {
        reply = await callAI(systemPrompt, userTextFull, fileUrls, currentMsgs || [], effectiveSettings);
        completeLastStep();
      } catch (e) {
        reply = `⚠️ Erro ao processar resposta: ${e.message || 'falha desconhecida'}. Tente novamente.`;
      }

      // ── Predictive Context Scan (every 10 messages) ──
      try {
        const predictiveNote = predictiveContextScan(currentMsgs || [], settings.user_name || 'Jadiel');
        if (predictiveNote) reply += predictiveNote;
      } catch {}

      if (detectedAgent && !isVoiceMode) {
        reply = `${detectedAgent.icon} **[${detectedAgent.name}]**\n\n${reply}`;
      }

      // ── Increment message counter + check sync report ──
      if (currentUser?.email && evolutionProfileRef.current) {
        incrementMessageCount(currentUser.email, evolutionProfileRef.current).then(({ updated, shouldSync }) => {
          evolutionProfileRef.current = updated;
          if (shouldSync) {
            generateSyncReport(currentUser.email, updated).then(syncMsg => {
              setTabs(prev => prev.map(t => {
                if (t.id === tid) {
                  return { ...t, messages: [...t.messages, { role: 'assistant', content: syncMsg, timestamp: Date.now() }] };
                }
                return t;
              }));
            });
          }
        });
      }
    }

    const assistantMessage = { role: 'assistant', content: reply, timestamp: Date.now() };

    setTabs(prev => prev.map(t => {
      if (t.id === tid) {
        const newMsgs = [...(currentMsgs || t.messages), assistantMessage];
        saveConversation(newMsgs, t.convId, tid).catch(() => {});
        return { ...t, messages: newMsgs };
      }
      return t;
    }));
    releaseLoading();
    // Clear steps after a short delay so user can see the completed state
    setTimeout(clearSteps, 2000);

    // Speak if voice-triggered or live mode
    if ((fromVoice || isLive) && settings.elevenlabs_api_key) {
      setLiveReply(reply.slice(0, 120));
      const spd = combatMode ? Math.max(settings.voice_speed || 1.0, 1.25) : (settings.voice_speed || 1.0);
      speak(reply, settings.elevenlabs_api_key, settings.voice_style || 'robotic', spd, null);
    }
  };

  const handleSend = (text, files, fromVoice) =>
    handleSendWithTabId(text, files, fromVoice).catch(e => {
      console.error('[JARVIS] handleSend unhandled error:', e);
      setIsLoading(false);
    });
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  const handleToggleLive = useCallback(() => {
    if (isLive) {
      stopLive();
      setShowLiveMode(false);
      setLiveMinimized(false);
    } else {
      startLive();
      setShowLiveMode(true);
      setLiveMinimized(false);
      setLiveTranscript('');
      setLiveReply('');
    }
  }, [isLive, startLive, stopLive]);

  const handleLiveMuteToggle = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
  }, [isMuted]);

  const handleLiveFileSelect = useCallback((file) => {
    handleSendRef.current('', [file], true);
  }, []);

  const handleCloseLive = useCallback(() => {
    stopLive();
    stopSpeaking();
    setShowLiveMode(false);
    setLiveMinimized(false);
    setIsMuted(false);
    isMutedRef.current = false;
    setLiveTranscript('');
    setLiveReply('');
  }, [stopLive, stopSpeaking]);

  // ── Render guards ─────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div className="h-screen bg-[#050a0f] flex items-center justify-center">
        <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }
  if (authState === 'unauthenticated') {
    return <LoginScreen onLoggedIn={() => setAuthState('authenticated')} />;
  }
  if (showSplash) {
    return (
      <SplashScreen
        onStart={handleStart}
        onQuickCommand={(cmd) => handleSendRef.current(cmd, [], false)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#050a0f] relative overflow-hidden">
      <HudOverlay />

      <ProtocolHeader
        protocolId={protocolId}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => setShowHistory(true)}
        combatMode={combatMode}
      />
      {/* Combat Mode Bar */}
      <CombatModeBar
        combatMode={combatMode}
        onToggle={() => setCombatMode(prev => !prev)}
      />

      {/* Conversation Tabs */}
      <ConversationTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitch={setActiveTabId}
        onNew={() => createTab()}
        onClose={closeTab}
      />

      {/* Deploy Monitor */}
      <DeployMonitor
        onDiagnosis={(diagnosisMsg) => {
          handleSendRef.current(diagnosisMsg, [], false);
        }}
      />

      {/* Thinking Status */}
      <ThinkingStatus steps={thinkingSteps} isLoading={isLoading} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative z-10">
        {messages.map((msg, i) => {
          // Find previous user message for context in feedback/regenerate
          const prevUserMsg = msg.role === 'assistant'
            ? [...messages].slice(0, i).reverse().find(m => m.role === 'user')
            : null;
          return (
            <MessageBubble
              key={i}
              message={msg}
              isSpeaking={isSpeaking}
              onSpeak={(text) => {
                if (isSpeaking) { stopSpeaking(); return; }
                if (settings.elevenlabs_api_key) {
                  speak(text, settings.elevenlabs_api_key, settings.voice_style || 'robotic', settings.voice_speed || 1.0, null);
                } else {
                  const u = new SpeechSynthesisUtterance(text.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').replace(/#{1,6}\s/g,''));
                  u.lang = settings.language || 'pt-BR';
                  window.speechSynthesis.speak(u);
                }
              }}
              onRegenerate={(m) => {
                if (prevUserMsg) handleSend(prevUserMsg.content, [], false);
              }}
              onFeedback={(type) => {
                if (!currentUser?.email || !evolutionProfileRef.current) return;
                const fn = type === 'like' ? recordLike : type === 'dislike' ? recordDislike : recordRegenerate;
                fn(currentUser.email, msg.content, prevUserMsg?.content, evolutionProfileRef.current)
                  .then(updated => { evolutionProfileRef.current = updated; });
              }}
            />
          );
        })}

        {/* Quick command shortcuts — shown only on fresh conversation */}
        {messages.length <= 1 && !isLoading && (
          <div className="animate-fade-in-up px-2 mt-2">
            <p className="text-[9px] font-mono text-cyan-700/50 mb-2 tracking-widest text-center">COMANDOS RÁPIDOS</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { icon: '🌤️', label: 'Clima', cmd: 'Como está o clima em São Paulo?' },
                { icon: '🧮', label: 'Calcular', cmd: 'Calcule 245 * 18' },
                { icon: '🗺️', label: 'Rota', cmd: 'Distância de São Paulo para Rio de Janeiro' },
                { icon: '💱', label: 'Moeda', cmd: '500 reais em dólar' },
                { icon: '😄', label: 'Piada', cmd: 'Conta uma piada' },
                { icon: '♈', label: 'Signo', cmd: 'Qual é meu signo?' },
              ].map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(cmd.cmd, [], false)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-cyan-800/30
                    hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all duration-300 group"
                >
                  <span className="text-xl">{cmd.icon}</span>
                  <span className="text-[9px] font-mono text-cyan-600/60 group-hover:text-cyan-400">{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        isListening={isListening}
        onToggleMic={handleToggleMic}
        isSpeaking={isSpeaking}
        isLiveVoice={isLive}
        onToggleLive={handleToggleLive}
      />

      {deviceChallenge && (
        <NewDeviceChallenge
          deviceId={deviceChallenge.deviceId}
          deviceLabel={deviceChallenge.deviceLabel}
          ipInfo={deviceChallenge.ipInfo}
          onSuccess={() => setDeviceChallenge(null)}
          onBlock={() => { setDeviceChallenge(null); base44.auth.logout('/SecurityBlock?jarvis_block=1'); }}
        />
      )}

      {showSettings && <SettingsPanel settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
      {showHistory && (
        <ConversationHistory
          currentMessages={messages}
          onLoadConversation={handleLoadConversation}
          onNewConversation={() => { createTab(); setShowHistory(false); }}
          onClose={() => setShowHistory(false)}
          userEmail={currentUser?.email}
        />
      )}

      {/* ── LIVE MODE FULL INTERFACE ─── */}
      {showLiveMode && !liveMinimized && (
        <LiveModeInterface
          isJarvisSpeaking={isSpeaking}
          isUserSpeaking={isUserSpeaking}
          onClose={handleCloseLive}
          onSwitchToText={() => setLiveMinimized(true)}
          onFileSelect={handleLiveFileSelect}
          onMuteToggle={handleLiveMuteToggle}
          isMuted={isMuted}
          transcript={liveTranscript}
          jarvisReply={liveReply}
        />
      )}

      {/* ── FLOATING BUBBLE (minimized live mode) ─── */}
      {showLiveMode && liveMinimized && (
        <button
          onClick={() => setLiveMinimized(false)}
          className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95"
          style={{
            background: 'radial-gradient(circle, #0080FF30 0%, #050a0f 80%)',
            border: '2px solid rgba(0,128,255,0.5)',
            boxShadow: isSpeaking
              ? '0 0 20px rgba(0,128,255,0.7), 0 0 40px rgba(0,128,255,0.3)'
              : isUserSpeaking
              ? '0 0 20px rgba(0,255,255,0.6), 0 0 40px rgba(0,255,255,0.2)'
              : '0 0 14px rgba(0,128,255,0.4)',
            animation: (isSpeaking || isUserSpeaking) ? 'pulse-orb 1.2s ease-in-out infinite' : 'none',
          }}
          title="Voltar ao Modo Live"
        >
          <span className="text-xl font-bold font-mono text-cyan-300">J</span>
        </button>
      )}
    </div>
  );
}
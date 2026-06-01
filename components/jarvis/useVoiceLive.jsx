import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Live voice — modo ligação contínua:
 * - Microfone SEMPRE aberto, nunca para sozinho
 * - Quando JARVIS fala, reconhecimento pausa internamente mas reinicia logo
 * - Detecta pausa natural (~700ms) para enviar transcrição
 * - Usuário NÃO precisa apertar botão para falar
 */
export function useVoiceLive({ onTranscript, onInterrupt, language = 'pt-BR' }) {
  const [isLive, setIsLive] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const isLiveRef = useRef(false);
  const pauseTimerRef = useRef(null);
  const accumulatedRef = useRef('');
  const isSendingRef = useRef(false);
  const restartingRef = useRef(false);

  const clearPauseTimer = () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const sendAccumulated = useCallback(() => {
    const text = accumulatedRef.current.trim();
    accumulatedRef.current = '';
    if (text && !isSendingRef.current) {
      isSendingRef.current = true;
      onTranscript(text);
      setTimeout(() => { isSendingRef.current = false; }, 1500);
    }
  }, [onTranscript]);

  const startRecognition = useCallback(() => {
    if (!isLiveRef.current || restartingRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    // Para o anterior sem disparar restart
    restartingRef.current = true;
    try { recognitionRef.current?.abort(); } catch {}

    setTimeout(() => {
      restartingRef.current = false;
      if (!isLiveRef.current) return;

      const rec = new SR();
      rec.lang = language;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      recognitionRef.current = rec;

      rec.onspeechstart = () => {
        setIsUserSpeaking(true);
        clearPauseTimer();
        onInterrupt?.(); // Para o JARVIS falar imediatamente
      };

      rec.onspeechend = () => {
        setIsUserSpeaking(false);
      };

      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript;
            if (text.trim()) {
              accumulatedRef.current += text + ' ';
              // Reinicia o timer a cada resultado final
              clearPauseTimer();
              pauseTimerRef.current = setTimeout(sendAccumulated, 700);
            }
          }
        }
      };

      rec.onend = () => {
        setIsUserSpeaking(false);
        // Reinicia automaticamente — simula ligação contínua
        if (isLiveRef.current && !restartingRef.current) {
          setTimeout(() => startRecognition(), 80);
        }
      };

      rec.onerror = (e) => {
        if (e.error === 'aborted') return; // ignorar abort intencional
        if (isLiveRef.current && !restartingRef.current) {
          setTimeout(() => startRecognition(), 200);
        }
      };

      try { rec.start(); } catch {
        setTimeout(() => startRecognition(), 300);
      }
    }, 80);
  }, [language, onInterrupt, sendAccumulated]);

  const start = useCallback(() => {
    if (isLiveRef.current) return;
    isLiveRef.current = true;
    setIsLive(true);
    accumulatedRef.current = '';
    isSendingRef.current = false;
    restartingRef.current = false;
    startRecognition();
  }, [startRecognition]);

  const stop = useCallback(() => {
    isLiveRef.current = false;
    restartingRef.current = false;
    setIsLive(false);
    setIsUserSpeaking(false);
    clearPauseTimer();
    accumulatedRef.current = '';
    isSendingRef.current = false;
    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;
  }, []);

  useEffect(() => () => stop(), []);

  return { isLive, isUserSpeaking, start, stop };
}
import { useState, useRef, useCallback } from 'react';

// Maps voice style to ElevenLabs voice IDs
const VOICE_IDS = {
  natural: 'pNInz6obpgDQGcFmaJgB',       // Adam - natural male
  robotic: 'VR6AewLTigWG4xSOukaG',        // Arnold - deep/robotic
  deep_robotic: 'ErXwobaYiN019PkySvjV',   // Antoni - deep robotic
};

export function useElevenLabsSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const onFinishedRef = useRef(null);

  const speak = useCallback(async (text, apiKey, voiceStyle = 'robotic', speed = 1.0, onFinished = null, stability = 0.7, similarity = 0.75) => {
    onFinishedRef.current = onFinished;
    if (!apiKey || !text) return false;
    
    // Clean markdown
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, ' ')
      .slice(0, 500); // ElevenLabs limit for free tier

    const voiceId = VOICE_IDS[voiceStyle] || VOICE_IDS.robotic;

    try {
      setIsSpeaking(true);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: clean,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: stability ?? (voiceStyle === 'deep_robotic' ? 0.9 : 0.7),
            similarity_boost: similarity ?? (voiceStyle === 'natural' ? 0.8 : 0.6),
            style: 0,
            use_speaker_boost: true,
          },
        }),
      });


      if (!response.ok) {
        setIsSpeaking(false);
        return false;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      const audio = new Audio(url);
      audio.playbackRate = speed || 1.0;
      // Garante que o áudio sai pelo speaker, não interfere no microfone
      audio.setSinkId?.('default').catch(() => {});
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        onFinishedRef.current?.();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        onFinishedRef.current?.();
      };
      
      await audio.play();
      return true;
    } catch (e) {
      console.warn('[ElevenLabs] TTS playback failed:', e.message);
      setIsSpeaking(false);
      return false;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stopSpeaking };
}
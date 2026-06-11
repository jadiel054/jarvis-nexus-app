// app/api/tts/speak/route.ts
// Server-side TTS: ElevenLabs (primary) → OpenAI TTS (fallback)
// Client falls back to Web Speech API if both fail
import { NextRequest } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text?.trim()) return new Response("No text", { status: 400 });

  const clean = text.slice(0, 600);

  // ── Option 1: ElevenLabs (best quality, natural Brazilian PT)
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey) {
    try {
      // Voice ID: Rachel (multilingual) or use a pt-BR voice
      const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: clean,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (r.ok) {
        const audio = await r.arrayBuffer();
        return new Response(audio, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
        });
      }
    } catch {}
  }

  // ── Option 2: OpenAI TTS (good quality)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: clean,
          voice: "onyx",    // deep, natural voice
          speed: 0.95,
        }),
      });
      if (r.ok) {
        const audio = await r.arrayBuffer();
        return new Response(audio, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
        });
      }
    } catch {}
  }

  // ── No TTS configured — client will use Web Speech API fallback
  return new Response("TTS not configured", { status: 503 });
}

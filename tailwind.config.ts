import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "jarvis-cyan":   "var(--neon-cyan)",
        "jarvis-purple": "var(--neon-purple)",
        "jarvis-pink":   "var(--neon-pink)",
        "jarvis-green":  "var(--neon-green)",
        "jarvis-yellow": "var(--neon-yellow)",
        "jarvis-bg":     "var(--bg-primary)",
        "jarvis-card":   "var(--bg-card)",
        "jarvis-text":   "var(--text-primary)",
        "jarvis-muted":  "var(--text-secondary)",
      },
      fontFamily: {
        orbitron: ["Orbitron", "sans-serif"],
        mono:     ["JetBrains Mono", "monospace"],
        sans:     ["Inter", "sans-serif"],
      },
      animation: {
        "glow-pulse":    "glow-pulse 2s ease-in-out infinite",
        "scanline":      "scanline 8s linear infinite",
        "boot-flicker":  "boot-flicker 0.15s ease-in-out 3",
        "spin-slow":     "spin 1.5s linear infinite",
        "fade-in":       "fade-in 0.3s ease forwards",
        "slide-up":      "slide-up 0.4s ease forwards",
      },
      keyframes: {
        "glow-pulse":   { "0%,100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
        "scanline":     { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100vh)" } },
        "boot-flicker": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.2" } },
        "fade-in":      { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        "slide-up":     { from: { opacity: "0", transform: "translateX(-16px)" }, to: { opacity: "1", transform: "none" } },
      },
    },
  },
  plugins: [],
} satisfies Config;

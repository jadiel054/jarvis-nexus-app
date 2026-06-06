import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        jarvis: {
          bg: '#050a0f',
          'bg-card': '#0d2030',
          'bg-secondary': '#0a1628',
          cyan: '#00FFFF',
          green: '#00FF88',
          red: '#FF4444',
          gold: '#FFD700',
          text: '#E0F7FA',
          'text-dim': '#37474F',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        orbitron: ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config

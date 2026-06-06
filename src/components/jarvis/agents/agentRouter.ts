import type { AgentKey } from '@/types/agent'
import { AGENT_TRIGGERS } from '@/lib/constants'

export function detectAgentMode(text: string): { agentKey: AgentKey; isAgentMode: boolean } {
  const lower = text.toLowerCase()

  if (AGENT_TRIGGERS.some(t => lower.includes(t))) {
    if (lower.includes('zarith') || lower.includes('deploy') || lower.includes('commit') || lower.includes('push'))
      return { agentKey: 'backend', isAgentMode: true }
    if (lower.includes('analisa') || lower.includes('repositório'))
      return { agentKey: 'analyst', isAgentMode: true }
    if (lower.includes('refatora') || lower.includes('css') || lower.includes('tailwind'))
      return { agentKey: 'devWeb', isAgentMode: true }
    return { agentKey: 'backend', isAgentMode: true }
  }

  return { agentKey: 'default', isAgentMode: false }
}

interface BuiltinResult {
  type: string
  input: string
}

export function detectBuiltinTool(text: string): BuiltinResult | null {
  const lower = text.toLowerCase().trim()

  if (/^(calcul|quanto|soma|subtrai|multiplica|divid)/.test(lower))
    return { type: 'calculator', input: text }
  if (/^(piada|me conta uma|humor)/.test(lower))
    return { type: 'joke', input: text }
  if (/^(signo|horóscopo)/.test(lower))
    return { type: 'zodiac', input: text }

  return null
}

export function executeBuiltin(builtin: BuiltinResult): string {
  switch (builtin.type) {
    case 'calculator': {
      try {
        const expr = builtin.input.replace(/[^0-9+\-*/().]/g, '')
        if (!expr) return 'Não entendi a expressão. Tente algo como "quanto é 2+2"'
        const result = Function(`"use strict"; return (${expr})`)()
        return `Resultado: **${result}**`
      } catch {
        return 'Não consegui calcular essa expressão.'
      }
    }
    case 'joke':
      return [
        'Por que o programador foi demitido? Porque ele não tinha classe.',
        'O que o JavaScript disse para o CSS? "Você não tem lógica!"',
        'Quantos programadores são necessários para trocar uma lâmpada? Nenhum, é problema de hardware.',
      ][Math.floor(Math.random() * 3)]
    case 'zodiac':
      return 'Me diga sua data de nascimento e eu te conto sobre seu signo!'
    default:
      return 'Comando não reconhecido.'
  }
}

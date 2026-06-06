interface Props { text: string }

export function SentimentIndicator({ text }: Props) {
  const lower = text.toLowerCase()
  let sentiment: { label: string; color: string } = { label: 'NEUTRO', color: 'text-[#37474F] border-[#37474F]/30' }

  if (/não funciona|erro|problema|travou|quebrou|ruim|péssimo/i.test(lower))
    sentiment = { label: 'NEGATIVO', color: 'text-orange-400 border-orange-400/30' }
  else if (/ótimo|perfeito|funciona|excelente|gostei|obrigado/i.test(lower))
    sentiment = { label: 'POSITIVO', color: 'text-[#00FF88] border-[#00FF88]/30' }
  else if (/como|por que|qual|quando|onde|o que|\?/i.test(lower))
    sentiment = { label: 'PERGUNTA', color: 'text-[#00FFFF] border-[#00FFFF]/30' }

  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${sentiment.color} mr-2`}>
      {sentiment.label}
    </span>
  )
}

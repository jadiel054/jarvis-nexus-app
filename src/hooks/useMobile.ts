import { useRef } from 'react'

export function useMobile() {
  const chatEndRef = useRef<HTMLDivElement>(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return { chatEndRef, isMobile }
}

import { useState, useEffect, type ReactNode } from 'react'

interface Props { children: ReactNode }

export default function BiometricGate({ children }: Props) {
  const [verified, setVerified] = useState(false)
  const enrolled = localStorage.getItem('biometric_enrolled') === 'true'

  useEffect(() => {
    if (!enrolled) { setVerified(true); return }
    verifyBiometric().then(ok => {
      if (ok) setVerified(true)
    })
  }, [enrolled])

  async function verifyBiometric(): Promise<boolean> {
    try {
      const credentialId = localStorage.getItem('biometric_credential_id')
      if (!credentialId) return true

      const challenge = crypto.getRandomValues(new Uint8Array(32))
      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{
            id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000,
        }
      })
      return true
    } catch {
      return false
    }
  }

  if (!verified) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#050a0f] text-[#00FFFF] p-6">
        <div className="text-4xl mb-4">👆</div>
        <h2 className="font-mono text-lg mb-2">Verificação Biométrica</h2>
        <p className="font-mono text-sm text-[#37474F] mb-6 text-center">
          Use sua digital para acessar o JARVIS
        </p>
        <button
          onClick={() => verifyBiometric().then(ok => ok && setVerified(true))}
          className="px-6 py-3 border border-[#00FFFF] rounded font-mono min-h-[44px]"
        >
          Verificar Digital
        </button>
      </div>
    )
  }

  return <>{children}</>
}

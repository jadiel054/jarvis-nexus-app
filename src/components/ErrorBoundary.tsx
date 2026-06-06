import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#050a0f] text-[#00FFFF] p-6">
          <h2 className="text-xl font-mono mb-4">ERRO DETECTADO</h2>
          <p className="text-[#37474F] font-mono text-sm mb-4 text-center">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-3 border border-[#00FFFF] rounded font-mono text-sm hover:bg-[#00FFFF]/10"
          >
            Reiniciar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

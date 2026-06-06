import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import SplashScreen from '@/components/jarvis/SplashScreen'
import LoginScreen from '@/components/jarvis/LoginScreen'
import BiometricGate from '@/components/jarvis/BiometricGate'
import Jarvis from '@/pages/Jarvis'
import DigitalAssets from '@/pages/DigitalAssets'
import ExportSource from '@/pages/ExportSource'
import SecurityBlock from '@/pages/SecurityBlock'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace />
  return <BiometricGate>{children}</BiometricGate>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/" element={<ProtectedRoute><Jarvis /></ProtectedRoute>} />
            <Route path="/assets" element={<ProtectedRoute><DigitalAssets /></ProtectedRoute>} />
            <Route path="/export-source" element={<ProtectedRoute><ExportSource /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><SecurityBlock /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="top-center" />
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

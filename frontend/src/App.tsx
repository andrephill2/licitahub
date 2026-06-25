import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { SearchPage } from './features/search/SearchPage'
import { TrackingPage } from './features/tracking/TrackingPage'
import { AdminPage } from './features/admin/AdminPage'
import { useAuthStore } from './stores/authStore'
import { useFavoritosStore } from './stores/favoritosStore'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
})

type View = 'search' | 'tracking' | 'admin'

function DashboardShell() {
  const [view, setView] = useState<View>('search')
  const { user } = useAuthStore()
  const { syncFromDB } = useFavoritosStore()

  useEffect(() => {
    if (user) syncFromDB()
  }, [user?.id])

  return (
    <Layout view={view} onViewChange={setView}>
      {view === 'search' && <SearchPage />}
      {view === 'tracking' && <TrackingPage />}
      {view === 'admin' && user?.role === 'master' && <AdminPage />}
    </Layout>
  )
}

function AppInit({ children }: { children: React.ReactNode }) {
  const { init } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    init().finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="h-8 w-8 text-indigo-500 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInit>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <DashboardShell />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/" replace />} />
          </Routes>
        </AppInit>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

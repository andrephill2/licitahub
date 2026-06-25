import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { SearchPage } from './features/search/SearchPage'
import { TrackingPage } from './features/tracking/TrackingPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
})

type View = 'search' | 'tracking' | 'admin'

function App() {
  const [view, setView] = useState<View>('search')

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout view={view} onViewChange={setView}>
                  {view === 'search' && <SearchPage />}
                  {view === 'tracking' && <TrackingPage />}
                  {view === 'admin' && (
                    <div className="flex items-center justify-center py-24 text-slate-500">
                      <p>Gestão de usuários — em breve</p>
                    </div>
                  )}
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

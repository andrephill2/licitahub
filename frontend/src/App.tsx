import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { Icon } from './components/Icon'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
})

function DashboardPlaceholder() {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-slate-500 dark:text-slate-400">
      <Icon name="zap" className="h-12 w-12 text-indigo-500" />
      <div className="text-center">
        <p className="text-xl font-semibold text-slate-700 dark:text-slate-300">LicitaHub</p>
        <p className="text-sm mt-1">Dashboard em construção — componentes sendo migrados</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardPlaceholder />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

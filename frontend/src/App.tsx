import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { LandingPage } from './features/landing/LandingPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { SearchPage } from './features/search/SearchPage'
import { TrackingPage } from './features/tracking/TrackingPage'
import { CalendarioPage } from './features/calendar/CalendarioPage'
import { AnaliseConcorrentesPage } from './features/concorrentes/AnaliseConcorrentesPage'
import { AdminPage } from './features/admin/AdminPage'
import { TeamPage } from './features/team/TeamPage'
import { ManualPage } from './features/manual/ManualPage'
import { OnboardingModal } from './features/onboarding/OnboardingModal'
import { useAuthStore } from './stores/authStore'
import { useFavoritosStore } from './stores/favoritosStore'
import { useTabsStore } from './stores/tabsStore'
import { useTeamStore } from './stores/teamStore'
import { useNavStore } from './stores/navStore'
import { loadSavedSearches } from './lib/savedSearches'
import { runSearch } from './lib/searchApi'
import { clearPncpCache } from './lib/pncpCache'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
})

type View = 'search' | 'tracking' | 'calendario' | 'concorrentes' | 'team' | 'admin' | 'manual'

function DashboardShell() {
  const [view, setView] = useState<View>('search')
  const { user, logout, validateSession } = useAuthStore()

  // Volta ao topo ao trocar de módulo — sem isso a nova tela abre na posição
  // de scroll da anterior e parece vazia/quebrada.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  // Clique numa notificação do sino pede um card de Acompanhamento — troca
  // para essa aba; o TrackingPage cuida de rolar/destacar o card.
  const focusTrackingCard = useNavStore((s) => s.focusTrackingCard)
  useEffect(() => {
    if (focusTrackingCard) setView('tracking')
  }, [focusTrackingCard])
  const { syncFromDB } = useFavoritosStore()
  const { loadTeam, teamSearches, reset: resetTeam } = useTeamStore()
  const openedTeamKeywords = useRef<Set<string>>(new Set())

  // Validação de sessão única: no foco da janela e a cada 2 minutos
  useEffect(() => {
    if (!user?.id) return

    async function check() {
      const valid = await validateSession()
      if (!valid) {
        await logout('Sua sessão foi encerrada em outro dispositivo.')
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') check()
    }

    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = setInterval(check, 2 * 60 * 1000)

    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(interval)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      // Logout — limpa estado em memória de todos os stores
      resetTeam()
      useTabsStore.getState().clearAll()
      useFavoritosStore.setState({ favoritos: {}, statuses: {}, archived: {}, knownFileCounts: {} })
      clearPncpCache()
      openedTeamKeywords.current.clear()
      return
    }

    // Re-chave os stores localStorage para o usuário atual.
    // IMPORTANTE: limpar na chave GENÉRICA antes de trocar para a chave do usuário,
    // para não sobrescrever os dados salvos do usuário com estado vazio.
    useTabsStore.persist.setOptions({ name: 'licitahub-tabs' })
    useTabsStore.getState().clearAll()
    useTabsStore.persist.setOptions({ name: `licitahub-tabs::${user.id}` })
    useTabsStore.persist.rehydrate()

    useFavoritosStore.persist.setOptions({ name: 'licitahub-favoritos' })
    useFavoritosStore.setState({ favoritos: {}, statuses: {}, archived: {}, knownFileCounts: {} })
    useFavoritosStore.persist.setOptions({ name: `licitahub-favoritos::${user.id}` })
    useFavoritosStore.persist.rehydrate()

    resetTeam()

    // Carrega favoritos do Supabase
    syncFromDB()

    // Carrega time e buscas do Supabase em paralelo
    Promise.all([
      // Buscas pessoais — abre todas as abas imediatamente, depois busca em paralelo
      loadSavedSearches().then((searches) => {
        const { openTab, updateTab } = useTabsStore.getState()
        for (const { keyword, filters } of searches) openTab(keyword, filters, false)
        return Promise.all(
          searches.map(async ({ keyword, filters }) => {
            try {
              const result = await runSearch(keyword, filters, new Set(),
                (partial) => updateTab(keyword, { items: partial, total: partial.length }))
              updateTab(keyword, { items: result.items, total: result.total, loading: false })
            } catch {
              updateTab(keyword, { loading: false })
            }
          })
        )
      }),
      // Time
      loadTeam(),
    ]).catch(() => {})
  }, [user?.id])

  // Carregar buscas do time — processa apenas as novas para evitar re-abertura desnecessária
  useEffect(() => {
    if (!teamSearches.length) return
    const { openTab, updateTab } = useTabsStore.getState()
    const teamStore = useTeamStore.getState()

    const newSearches = teamSearches.filter((ts) => !openedTeamKeywords.current.has(ts.keyword))
    for (const ts of newSearches) {
      openedTeamKeywords.current.add(ts.keyword)
      openTab(ts.keyword, ts.filters, true, teamStore.team?.id)
      runSearch(ts.keyword, ts.filters, new Set(),
        (partial) => updateTab(ts.keyword, { items: partial, total: partial.length }))
        .then((result) => updateTab(ts.keyword, { items: result.items, total: result.total, loading: false }))
        .catch(() => updateTab(ts.keyword, { loading: false }))
    }
  }, [teamSearches])

  const needsOnboarding = !!user && user.role !== 'master' && !user.cnpj

  return (
    <Layout view={view} onViewChange={setView}>
      {needsOnboarding && <OnboardingModal />}
      {view === 'search' && <SearchPage />}
      {view === 'tracking' && <TrackingPage />}
      {view === 'calendario' && <CalendarioPage />}
      {view === 'concorrentes' && <AnaliseConcorrentesPage />}
      {view === 'team' && <TeamPage />}
      {view === 'admin' && user?.role === 'master' && <AdminPage />}
      {view === 'manual' && <ManualPage />}
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
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardShell />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AppInit>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

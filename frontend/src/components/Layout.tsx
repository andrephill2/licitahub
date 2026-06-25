import { useState } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'
import { useAuthStore } from '../stores/authStore'
import { useTabsStore } from '../stores/tabsStore'
import { cn } from '../lib/utils'

type View = 'search' | 'tracking' | 'admin'

interface LayoutProps {
  view: View
  onViewChange: (v: View) => void
  children: React.ReactNode
}

export function Layout({ view, onViewChange, children }: LayoutProps) {
  const { user, logout } = useAuthStore()
  const { tabs, activeTab, setActiveTab, closeTab } = useTabsStore()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggleDark() {
    document.documentElement.classList.toggle('dark')
    setDark((v) => !v)
  }

  const diasRestantes = (() => {
    if (!user || user.role === 'master' || !user.expirationDate) return null
    const diff = new Date(user.expirationDate + 'T23:59:59').getTime() - Date.now()
    const days = Math.ceil(diff / 86400000)
    return isNaN(days) ? 0 : days
  })()

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Navbar */}
      <header className="border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Icon name="zap" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">LicitaHub</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <span className="text-indigo-600 dark:text-indigo-400">{user?.username}</span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                {user?.role === 'master' ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Master</span>
                ) : (
                  <span className={cn(diasRestantes !== null && diasRestantes <= 3 ? 'text-red-600 animate-pulse' : 'text-blue-600')}>
                    {diasRestantes !== null ? `${diasRestantes}d restantes` : ''}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Module nav */}
          <nav className="flex items-center gap-1">
            {([
              { id: 'search', icon: 'search', label: 'Busca' },
              { id: 'tracking', icon: 'star', label: 'Painel' },
              ...(user?.role === 'master' ? [{ id: 'admin', icon: 'settings', label: 'Admin' }] : []),
            ] as { id: View; icon: string; label: string }[]).map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => onViewChange(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  view === id
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Icon name={icon as Parameters<typeof Icon>[0]['name']} className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={toggleDark} className="!p-2 rounded-full">
              <Icon name={dark ? 'sun' : 'moon'} className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="!p-2 rounded-full" title="Sair">
              <Icon name="logout" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search tabs bar (only on search view) */}
        {view === 'search' && tabs.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
            <div className="flex items-center px-4 gap-1 min-w-max py-1">
              <button
                onClick={() => setActiveTab('FAVORITOS')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                  activeTab === 'FAVORITOS'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Icon name="star" className="h-3.5 w-3.5" />
                Favoritos
              </button>

              {tabs.map((tab) => (
                <button
                  key={tab.keyword}
                  onClick={() => setActiveTab(tab.keyword)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap group',
                    activeTab === tab.keyword
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {tab.loading && (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  )}
                  <span className="capitalize max-w-[120px] truncate">{tab.keyword}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.keyword) }}
                    className="opacity-0 group-hover:opacity-100 ml-1 hover:text-red-500 transition-opacity"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}

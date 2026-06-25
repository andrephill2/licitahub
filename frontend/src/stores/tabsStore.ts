import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LicitacaoItem, SearchFilters } from '../types'

export interface SearchTab {
  keyword: string
  filters: SearchFilters & { searchType?: string }
  items: LicitacaoItem[]
  total: number
  loading: boolean
}

interface TabsStore {
  tabs: SearchTab[]
  activeTab: string | null
  setActiveTab: (tab: string | null) => void
  openTab: (keyword: string, filters: SearchTab['filters']) => void
  closeTab: (keyword: string) => void
  updateTab: (keyword: string, patch: Partial<SearchTab>) => void
  clearAll: () => void
}

export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTab: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      openTab: (keyword, filters) => {
        const { tabs } = get()
        const exists = tabs.find((t) => t.keyword === keyword)
        if (exists) {
          set({ activeTab: keyword, tabs: tabs.map((t) => t.keyword === keyword ? { ...t, loading: true, filters } : t) })
        } else {
          set({ activeTab: keyword, tabs: [...tabs, { keyword, filters, items: [], total: 0, loading: true }] })
        }
      },

      closeTab: (keyword) => {
        const { tabs, activeTab } = get()
        const next = tabs.filter((t) => t.keyword !== keyword)
        let nextActive = activeTab
        if (activeTab === keyword) nextActive = next.length > 0 ? next[next.length - 1].keyword : 'FAVORITOS'
        set({ tabs: next, activeTab: nextActive })
      },

      updateTab: (keyword, patch) =>
        set((s) => ({ tabs: s.tabs.map((t) => t.keyword === keyword ? { ...t, ...patch } : t) })),

      clearAll: () => set({ tabs: [], activeTab: null }),
    }),
    {
      name: 'licitahub-tabs',
      partialize: (s) => ({ tabs: s.tabs.map((t) => ({ ...t, loading: false })), activeTab: s.activeTab }),
    }
  )
)

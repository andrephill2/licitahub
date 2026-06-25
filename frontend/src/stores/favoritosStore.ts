import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LicitacaoItem, ItemStatus, Favorito } from '../types'

interface FavoritosStore {
  favoritos: Record<string, Favorito>
  statuses: Record<string, ItemStatus>
  archived: Record<string, { archivedAt: string }>
  addFavorito: (item: LicitacaoItem) => void
  removeFavorito: (id: string) => void
  setStatus: (id: string, status: Partial<ItemStatus>) => void
  archiveItem: (id: string) => void
  unarchiveItem: (id: string) => void
}

export const useFavoritosStore = create<FavoritosStore>()(
  persist(
    (set) => ({
      favoritos: {},
      statuses: {},
      archived: {},

      addFavorito: (item) =>
        set((s) => ({
          favoritos: { ...s.favoritos, [item.id]: { item, savedAt: new Date().toISOString() } },
        })),

      removeFavorito: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.favoritos
          return { favoritos: rest }
        }),

      setStatus: (id, status) =>
        set((s) => ({
          statuses: { ...s.statuses, [id]: { ...s.statuses[id], ...status } },
        })),

      archiveItem: (id) =>
        set((s) => ({
          archived: { ...s.archived, [id]: { archivedAt: new Date().toISOString() } },
        })),

      unarchiveItem: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.archived
          return { archived: rest }
        }),
    }),
    { name: 'licitahub-favoritos' }
  )
)

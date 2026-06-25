import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LicitacaoItem, ItemStatus, Favorito } from '../types'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

interface FavoritosStore {
  favoritos: Record<string, Favorito>
  statuses: Record<string, ItemStatus>
  archived: Record<string, { archivedAt: string }>
  addFavorito: (item: LicitacaoItem) => Promise<void>
  removeFavorito: (id: string) => Promise<void>
  setStatus: (id: string, status: Partial<ItemStatus>) => Promise<void>
  archiveItem: (id: string) => void
  unarchiveItem: (id: string) => void
  syncFromDB: () => Promise<void>
}

function userId() {
  return useAuthStore.getState().user?.id
}

export const useFavoritosStore = create<FavoritosStore>()(
  persist(
    (set, get) => ({
      favoritos: {},
      statuses: {},
      archived: {},

      syncFromDB: async () => {
        const uid = userId()
        if (!uid) return

        const [{ data: favs }, { data: sts }] = await Promise.all([
          supabase.from('favoritos').select('item_id, item_data, saved_at').eq('user_id', uid),
          supabase.from('item_statuses').select('item_id, fase, posicionamento, go, prazo_lance, prazo_esclarec').eq('user_id', uid),
        ])

        const favMap: Record<string, Favorito> = {}
        ;(favs || []).forEach((f) => {
          favMap[f.item_id] = { item: f.item_data as LicitacaoItem, savedAt: f.saved_at }
        })

        const stMap: Record<string, ItemStatus> = {}
        ;(sts || []).forEach((s) => {
          stMap[s.item_id] = {
            fase: s.fase as ItemStatus['fase'],
            posicionamento: s.posicionamento ?? undefined,
            go: s.go ?? undefined,
            prazoLance: s.prazo_lance ?? undefined,
            prazoEsclarecimento: s.prazo_esclarec ?? undefined,
          }
        })

        set({ favoritos: favMap, statuses: stMap })
      },

      addFavorito: async (item) => {
        const uid = userId()
        set((s) => ({ favoritos: { ...s.favoritos, [item.id]: { item, savedAt: new Date().toISOString() } } }))
        if (uid) {
          await supabase.from('favoritos').upsert({ user_id: uid, item_id: item.id, item_data: item as Record<string, unknown> })
        }
      },

      removeFavorito: async (id) => {
        const uid = userId()
        set((s) => {
          const { [id]: _, ...rest } = s.favoritos
          return { favoritos: rest }
        })
        if (uid) await supabase.from('favoritos').delete().eq('user_id', uid).eq('item_id', id)
      },

      setStatus: async (id, patch) => {
        const uid = userId()
        set((s) => ({ statuses: { ...s.statuses, [id]: { ...s.statuses[id], ...patch } } }))
        if (uid) {
          const current = get().statuses[id] || {}
          await supabase.from('item_statuses').upsert({
            user_id: uid,
            item_id: id,
            fase: current.fase ?? null,
            posicionamento: current.posicionamento ?? null,
            go: current.go ?? null,
            prazo_lance: current.prazoLance ?? null,
            prazo_esclarec: current.prazoEsclarecimento ?? null,
          })
        }
      },

      archiveItem: (id) =>
        set((s) => ({ archived: { ...s.archived, [id]: { archivedAt: new Date().toISOString() } } })),

      unarchiveItem: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.archived
          return { archived: rest }
        }),
    }),
    { name: 'licitahub-favoritos' }
  )
)

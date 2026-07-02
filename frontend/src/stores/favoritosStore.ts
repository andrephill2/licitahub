import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LicitacaoItem, ItemStatus, Favorito } from '../types'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

interface FavoritosStore {
  favoritos: Record<string, Favorito>
  statuses: Record<string, ItemStatus>
  archived: Record<string, { archivedAt: string; item?: LicitacaoItem }>
  knownFileCounts: Record<string, number>
  addFavorito: (item: LicitacaoItem) => Promise<void>
  removeFavorito: (id: string) => Promise<void>
  setStatus: (id: string, status: Partial<ItemStatus>) => Promise<void>
  archiveItem: (id: string, item?: LicitacaoItem) => Promise<void>
  unarchiveItem: (id: string) => void
  deleteFromArchived: (id: string) => void
  setKnownFileCount: (id: string, count: number) => Promise<void>
  syncFromDB: () => Promise<void>
}

function userId() {
  return useAuthStore.getState().user?.id
}

// Campos que existiam antes da migração pendencias_20260701.sql
function toDbLegacy(id: string, st: ItemStatus, uid: string) {
  return {
    user_id: uid,
    item_id: id,
    fase: st.fase ?? null,
    posicionamento: st.posicionamento ?? null,
    gonogo: st.gonogo ?? null,
    suspenso: st.suspenso ?? null,
    sistema: st.sistema ?? null,
    modos: st.modos ?? null,
    notas: st.notas ?? null,
    certame: st.certame ?? null,
    prazo_lance: st.prazoLance ?? null,
    prazo_esclarec: st.prazoEsclarecimento ?? null,
    prazo_recurso: st.prazoRecurso ?? null,
    prazo_questionamento: st.prazoQuestionamento ?? null,
    prazo_propostas: st.prazoPropostas ?? null,
  }
}

function toDb(id: string, st: ItemStatus, uid: string) {
  return {
    ...toDbLegacy(id, st, uid),
    responsavel: st.responsavel ?? null,
    drive_url: st.driveUrl ?? null,
    prazo_contrarrazao: st.prazoContrarrazao ?? null,
    itens: st.itens ?? null,
    habilitacao: st.habilitacao ?? null,
    exigencias: st.exigencias ?? null,
  }
}

// Upsert com fallback: se as colunas novas ainda não existirem no Supabase
// (migração não aplicada), regrava só os campos legados para não perder o sync.
async function upsertStatus(id: string, st: ItemStatus, uid: string) {
  const { error } = await supabase.from('item_statuses').upsert(toDb(id, st, uid))
  if (error) await supabase.from('item_statuses').upsert(toDbLegacy(id, st, uid))
}

function fromDb(s: Record<string, unknown>): ItemStatus {
  const st: ItemStatus = {
    fase: (s.fase as ItemStatus['fase']) ?? undefined,
    posicionamento: (s.posicionamento as string) ?? undefined,
    gonogo: (s.gonogo as ItemStatus['gonogo']) ?? undefined,
    suspenso: (s.suspenso as boolean) ?? undefined,
    sistema: (s.sistema as string) ?? undefined,
    modos: (s.modos as ItemStatus['modos']) ?? undefined,
    notas: (s.notas as string) ?? undefined,
    certame: (s.certame as string) ?? undefined,
    prazoLance: (s.prazo_lance as string) ?? undefined,
    prazoEsclarecimento: (s.prazo_esclarec as string) ?? undefined,
    prazoRecurso: (s.prazo_recurso as string) ?? undefined,
    prazoContrarrazao: (s.prazo_contrarrazao as string) ?? undefined,
    prazoQuestionamento: (s.prazo_questionamento as string) ?? undefined,
    prazoPropostas: (s.prazo_propostas as string) ?? undefined,
    responsavel: (s.responsavel as string) ?? undefined,
    driveUrl: (s.drive_url as string) ?? undefined,
    itens: (s.itens as ItemStatus['itens']) ?? undefined,
    habilitacao: (s.habilitacao as ItemStatus['habilitacao']) ?? undefined,
    exigencias: (s.exigencias as ItemStatus['exigencias']) ?? undefined,
  }
  // Remove chaves undefined para o merge com o estado local não apagar
  // campos que só existem no localStorage (migração ainda não aplicada).
  ;(Object.keys(st) as (keyof ItemStatus)[]).forEach((k) => { if (st[k] === undefined) delete st[k] })
  return st
}

export const useFavoritosStore = create<FavoritosStore>()(
  persist(
    (set, get) => ({
      favoritos: {},
      statuses: {},
      archived: {},
      knownFileCounts: {},

      syncFromDB: async () => {
        const uid = userId()
        if (!uid) return

        const [{ data: favs }, { data: sts }] = await Promise.all([
          supabase.from('favoritos').select('item_id, item_data, saved_at').eq('user_id', uid),
          supabase.from('item_statuses').select('*').eq('user_id', uid),
        ])

        const favMap: Record<string, Favorito> = {}
        ;(favs || []).forEach((f) => {
          favMap[f.item_id] = { item: f.item_data as LicitacaoItem, savedAt: f.saved_at }
        })

        const stMap: Record<string, ItemStatus> = {}
        ;(sts || []).forEach((s) => {
          stMap[s.item_id] = fromDb(s as Record<string, unknown>)
        })

        // Merge: DB is authoritative for fields it knows, preserve local-only fields
        const current = get()
        const mergedStatuses: Record<string, ItemStatus> = { ...current.statuses }
        for (const id of Object.keys(stMap)) {
          mergedStatuses[id] = { ...current.statuses[id], ...stMap[id] }
        }

        // Merge known_file_count from DB
        const mergedCounts: Record<string, number> = { ...current.knownFileCounts }
        ;(sts || []).forEach((s) => {
          if (s.known_file_count != null) mergedCounts[s.item_id] = s.known_file_count as number
        })

        set({ favoritos: favMap, statuses: mergedStatuses, knownFileCounts: mergedCounts })
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
          const { [id]: _f, ...favs } = s.favoritos
          const { [id]: _s, ...sts } = s.statuses
          const { [id]: _k, ...counts } = s.knownFileCounts
          return { favoritos: favs, statuses: sts, knownFileCounts: counts }
        })
        if (uid) {
          await Promise.all([
            supabase.from('favoritos').delete().eq('user_id', uid).eq('item_id', id),
            supabase.from('item_statuses').delete().eq('user_id', uid).eq('item_id', id),
          ])
        }
      },

      setStatus: async (id, patch) => {
        const uid = userId()
        let merged: ItemStatus = {}
        set((s) => {
          merged = { ...s.statuses[id], ...patch }
          return { statuses: { ...s.statuses, [id]: merged } }
        })
        if (uid) {
          await upsertStatus(id, merged, uid)
        }
      },

      archiveItem: async (id, item) => {
        set((s) => ({ archived: { ...s.archived, [id]: { archivedAt: new Date().toISOString(), item } } }))
        // Remove from active favoritos so it disappears from tracking
        await get().removeFavorito(id)
      },

      unarchiveItem: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.archived
          return { archived: rest }
        }),

      deleteFromArchived: (id) => get().unarchiveItem(id),

      setKnownFileCount: async (id, count) => {
        const uid = userId()
        set((s) => ({ knownFileCounts: { ...s.knownFileCounts, [id]: count } }))
        if (uid) {
          await supabase.from('item_statuses').upsert({
            user_id: uid,
            item_id: id,
            known_file_count: count,
          })
        }
      },
    }),
    { name: 'licitahub-favoritos' }
  )
)

import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import type { SearchFilters } from '../types'

function uid() {
  return useAuthStore.getState().user?.id ?? null
}

export async function loadSavedSearches(): Promise<{ keyword: string; filters: SearchFilters & { searchType?: string } }[]> {
  const userId = uid()
  if (!userId) return []

  const { data } = await supabase
    .from('saved_searches')
    .select('keyword, filters')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  return (data || []).map((row) => ({
    keyword: row.keyword as string,
    filters: (row.filters ?? {}) as SearchFilters & { searchType?: string },
  }))
}

export async function upsertSavedSearch(
  keyword: string,
  filters: SearchFilters & { searchType?: string }
): Promise<void> {
  const userId = uid()
  if (!userId) return

  await supabase.from('saved_searches').upsert(
    { user_id: userId, keyword, filters: filters as Record<string, unknown> },
    { onConflict: 'user_id,keyword' }
  )
}

export async function removeSavedSearch(keyword: string): Promise<void> {
  const userId = uid()
  if (!userId) return

  await supabase.from('saved_searches').delete().eq('user_id', userId).eq('keyword', keyword)
}

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; role: 'master' | 'common'; expiration_date: string }
      }
      favoritos: {
        Row: { id: number; user_id: string; item_id: string; item_data: Record<string, unknown>; saved_at: string }
        Insert: { user_id: string; item_id: string; item_data: Record<string, unknown> }
      }
      item_statuses: {
        Row: { user_id: string; item_id: string; fase: string | null; posicionamento: string | null; go: boolean | null; prazo_lance: string | null; prazo_esclarec: string | null }
        Insert: { user_id: string; item_id: string; fase?: string; posicionamento?: string; go?: boolean; prazo_lance?: string; prazo_esclarec?: string }
      }
    }
  }
}

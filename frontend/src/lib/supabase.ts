import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lwdmtlmzbqfltljlwjhg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZG10bG16YnFmbHRsamx3amhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTg3MzAsImV4cCI6MjA5Nzk3NDczMH0.Cbzi7XY9ExYc3qJ7c60yGRb86Pjp2VMZPRtSy7bz1EM'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string; role: 'master' | 'common'; expiration_date: string; cnpj: string | null; session_token: string | null }
        Insert: { id: string; username: string; role?: 'master' | 'common'; expiration_date?: string; cnpj?: string | null; session_token?: string | null }
        Update: { username?: string; role?: 'master' | 'common'; expiration_date?: string; cnpj?: string | null; session_token?: string | null }
        Relationships: []
      }
      favoritos: {
        Row: { id: number; user_id: string; item_id: string; item_data: Record<string, unknown>; saved_at: string }
        Insert: { user_id: string; item_id: string; item_data: Record<string, unknown> }
        Update: { item_data?: Record<string, unknown> }
        Relationships: []
      }
      item_statuses: {
        Row: { user_id: string; item_id: string; fase: string | null; posicionamento: string | null; go: boolean | null; prazo_lance: string | null; prazo_esclarec: string | null; gonogo: string | null; suspenso: boolean | null; sistema: string | null; modos: string | null; notas: string | null; certame: string | null; prazo_recurso: string | null; prazo_contrarrazao: string | null; prazo_questionamento: string | null; prazo_propostas: string | null; known_file_count: number | null; responsavel: string | null; drive_url: string | null; itens: Record<string, unknown> | null; habilitacao: Record<string, unknown> | null; exigencias: Record<string, unknown> | null }
        Insert: { user_id: string; item_id: string; fase?: string | null; posicionamento?: string | null; go?: boolean | null; prazo_lance?: string | null; prazo_esclarec?: string | null; gonogo?: string | null; suspenso?: boolean | null; sistema?: string | null; modos?: string | null; notas?: string | null; certame?: string | null; prazo_recurso?: string | null; prazo_contrarrazao?: string | null; prazo_questionamento?: string | null; prazo_propostas?: string | null; known_file_count?: number | null; responsavel?: string | null; drive_url?: string | null; itens?: Record<string, unknown> | null; habilitacao?: Record<string, unknown> | null; exigencias?: Record<string, unknown> | null }
        Update: { fase?: string | null; posicionamento?: string | null; go?: boolean | null; prazo_lance?: string | null; prazo_esclarec?: string | null; gonogo?: string | null; suspenso?: boolean | null; sistema?: string | null; modos?: string | null; notas?: string | null; certame?: string | null; prazo_recurso?: string | null; prazo_contrarrazao?: string | null; prazo_questionamento?: string | null; prazo_propostas?: string | null; known_file_count?: number | null; responsavel?: string | null; drive_url?: string | null; itens?: Record<string, unknown> | null; habilitacao?: Record<string, unknown> | null; exigencias?: Record<string, unknown> | null }
        Relationships: []
      }
      teams: {
        Row: { id: string; name: string; owner_id: string; cnpj: string | null; created_at: string }
        Insert: { name: string; owner_id: string; cnpj?: string | null }
        Update: { name?: string; cnpj?: string | null }
        Relationships: []
      }
      team_members: {
        Row: { id: string; team_id: string; user_id: string; username: string; role: string; status: string; initiated_by: string; joined_at: string | null; created_at: string }
        Insert: { team_id: string; user_id: string; username: string; role: string; status: string; initiated_by?: string; joined_at?: string | null }
        Update: { role?: string; status?: string; initiated_by?: string; joined_at?: string | null }
        Relationships: []
      }
      team_searches: {
        Row: { id: string; team_id: string; created_by: string; keyword: string; filters: Record<string, unknown>; created_at: string }
        Insert: { team_id: string; created_by: string; keyword: string; filters: Record<string, unknown> }
        Update: { filters?: Record<string, unknown> }
        Relationships: []
      }
      saved_searches: {
        Row: { id: string; user_id: string; keyword: string; filters: Record<string, unknown>; created_at: string }
        Insert: { user_id: string; keyword: string; filters: Record<string, unknown> }
        Update: { filters?: Record<string, unknown> }
        Relationships: []
      }
      notificacoes: {
        Row: { id: string; user_id: string; title: string; body: string; item_id: string | null; fase: string | null; read: boolean; created_at: string }
        Insert: { user_id: string; title: string; body: string; item_id?: string | null; fase?: string | null; read?: boolean }
        Update: { read?: boolean }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

import { supabase } from './supabase'

export interface Notificacao {
  id: string
  user_id: string
  title: string
  body: string
  item_id: string | null
  fase: string | null
  read: boolean
  created_at: string
}

// Todas as chamadas são defensivas: se a tabela `notificacoes` ainda não existir
// no Supabase (migration não aplicada), retornam vazio/no-op sem quebrar o app.

export async function listNotificacoes(userId: string): Promise<Notificacao[]> {
  try {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return []
    return (data || []) as Notificacao[]
  } catch { return [] }
}

export async function createNotificacao(n: {
  user_id: string; title: string; body: string; item_id?: string; fase?: string
}): Promise<void> {
  try {
    await supabase.from('notificacoes').insert({
      user_id: n.user_id,
      title: n.title,
      body: n.body,
      item_id: n.item_id ?? null,
      fase: n.fase ?? null,
    })
  } catch { /* tabela ausente ou sem permissão — ignora */ }
}

export async function markNotificacaoRead(id: string): Promise<void> {
  try { await supabase.from('notificacoes').update({ read: true }).eq('id', id) } catch { /* no-op */ }
}

export async function markAllNotificacoesRead(userId: string): Promise<void> {
  try {
    await supabase.from('notificacoes').update({ read: true }).eq('user_id', userId).eq('read', false)
  } catch { /* no-op */ }
}

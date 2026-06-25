import { useState, useEffect } from 'react'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'

interface UserProfile {
  id: string
  username: string
  role: 'master' | 'common'
  expiration_date: string
}

export function AdminPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [expiration, setExpiration] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadUsers() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${session?.access_token}` } })
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!username || !password || !expiration) { setError('Preencha todos os campos.'); return }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ username, password, expirationDate: expiration }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error || 'Erro ao criar usuário.'); return }
      setUsername(''); setPassword(''); setExpiration('')
      await loadUsers()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover o usuário "${name}"?`)) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/users?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } })
    setUsers((u) => u.filter((x) => x.id !== id))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Gestão de Usuários</h2>

      {/* Create form */}
      <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-6">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
          <Icon name="user" className="h-4 w-4 text-indigo-500" />
          Novo Usuário
        </h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Usuário</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nome.sobrenome"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Validade</label>
            <input
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <Icon name="alert" className="h-3.5 w-3.5" />{error}
            </p>
          )}
          <Button type="submit" loading={saving} size="sm">
            <Icon name="plus" className="h-4 w-4" />
            Criar usuário
          </Button>
        </form>
      </div>

      {/* User list */}
      <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Usuários ativos</h3>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-400">Carregando...</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map((u) => {
              const expired = new Date(u.expiration_date) < new Date()
              return (
                <div key={u.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{u.username}</p>
                    <p className="text-xs text-slate-400">
                      {u.role === 'master' ? '🔑 Master' : `Válido até ${new Date(u.expiration_date).toLocaleDateString('pt-BR')}`}
                      {expired && u.role !== 'master' && <span className="ml-2 text-red-500 font-bold">EXPIRADO</span>}
                    </p>
                  </div>
                  {u.role !== 'master' && (
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

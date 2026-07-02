import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Button } from '../../components/Button'
import { useAuthStore, SessionConflictError } from '../../stores/authStore'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const navigate = useNavigate()
  const { login, user, sessionKickedMsg, clearKickedMsg } = useAuthStore()

  useEffect(() => {
    if (user) navigate('/app', { replace: true })
  }, [user])

  useEffect(() => {
    if (sessionKickedMsg) {
      const t = setTimeout(clearKickedMsg, 6000)
      return () => clearTimeout(t)
    }
  }, [sessionKickedMsg])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setShowConflict(false)
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/app')
    } catch (e) {
      if (e instanceof SessionConflictError) {
        setShowConflict(true)
      } else {
        setError(e instanceof Error ? e.message : 'Erro ao fazer login.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleForceLogin() {
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password, true)
      navigate('/app')
    } catch (e) {
      setShowConflict(false)
      setError(e instanceof Error ? e.message : 'Erro ao fazer login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-slate-900 dark:to-indigo-950 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M3 18L8 11L13 15L21 5" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 5H15" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 5V11" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-2xl font-bold tracking-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>
              Lici<span style={{color:'#9D6FFF'}}>trend</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Monitoramento de licitações</p>
        </div>

        {sessionKickedMsg && (
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            {sessionKickedMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 transition"
              placeholder="seu.usuario"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-606 bg-white dark:bg-slate-700 px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <Icon name={showPass ? 'eyeOff' : 'eye'} className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
              <Icon name="alert" className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {showConflict ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4 space-y-3">
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                Você já está conectado em outro dispositivo. Quer encerrar aquela sessão?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConflict(false)}
                  className="flex-1 text-sm rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <Button
                  type="button"
                  onClick={handleForceLogin}
                  loading={loading}
                  className="flex-1 justify-center bg-amber-600 hover:bg-amber-700 border-amber-600"
                >
                  Entrar aqui
                </Button>
              </div>
            </div>
          ) : (
            <Button type="submit" loading={loading} className="w-full justify-center mt-2">
              <Icon name="login" className="h-4 w-4" />
              Entrar
            </Button>
          )}
        </form>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Não tem conta?{' '}
          <Link to="/register" className="text-indigo-500 hover:underline font-semibold">
            Solicitar acesso
          </Link>
          {' · '}
          <Link to="/" className="text-slate-400 hover:underline">
            Voltar ao site
          </Link>
        </p>
      </div>
    </div>
  )
}

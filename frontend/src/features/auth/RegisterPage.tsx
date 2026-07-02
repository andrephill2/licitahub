import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const PLANOS = [
  { id: 'basico', label: 'Básico', preco: 'R$ 80/mês', desc: '1 usuário · varredura 30 min' },
  { id: 'equipe', label: 'Equipe', preco: 'R$ 240/mês', desc: 'Até 5 usuários · varredura 5 min' },
  { id: 'enterprise', label: 'Enterprise', preco: 'Sob consulta', desc: 'Usuários ilimitados · varredura 1 min' },
]

export function RegisterPage() {
  const [searchParams] = useSearchParams()
  const planoInicial = searchParams.get('plano') ?? 'equipe'

  const [form, setForm] = useState({
    nome: '',
    email: '',
    empresa: '',
    telefone: '',
    plano: planoInicial,
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Erro ao enviar. Tente novamente.')
      }
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#100A1C',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: "'Inter', sans-serif",
        color: '#F1EDFA',
      }}
    >
      {/* Logo */}
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '32px',
          textDecoration: 'none',
          color: 'inherit',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: '20px',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 18L8 11L13 15L21 5" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 5H15" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 5V11" stroke="#9D6FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Lici<span style={{ color: '#9D6FFF' }}>trend</span>
      </Link>

      {done ? (
        <div
          style={{
            background: '#19122B',
            border: '1px solid #2E2548',
            borderRadius: '16px',
            padding: '48px 40px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', margin: '0 0 12px' }}>
            Recebemos seu cadastro!
          </h2>
          <p style={{ color: '#A89FC2', fontSize: '15px', margin: '0 0 28px' }}>
            Entraremos em contato em breve no e-mail <strong style={{ color: '#F1EDFA' }}>{form.email}</strong> para liberar o seu acesso.
          </p>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#9D6FFF',
              color: '#170F2B',
              fontWeight: 600,
              fontSize: '14px',
              padding: '11px 22px',
              borderRadius: '8px',
              textDecoration: 'none',
            }}
          >
            Voltar ao início
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: '#19122B',
            border: '1px solid #2E2548',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '480px',
            width: '100%',
          }}
        >
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '24px',
              margin: '0 0 6px',
              color: '#F1EDFA',
            }}
          >
            Criar conta
          </h1>
          <p style={{ color: '#A89FC2', fontSize: '14px', margin: '0 0 28px' }}>
            Preencha seus dados e entraremos em contato para liberar o acesso.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Plano */}
            <div>
              <label style={labelStyle}>Plano desejado</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {PLANOS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set('plano', p.id)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '12px 10px',
                      borderRadius: '10px',
                      border: `2px solid ${form.plano === p.id ? '#9D6FFF' : '#2E2548'}`,
                      background: form.plano === p.id ? 'rgba(157,111,255,.12)' : '#201935',
                      color: form.plano === p.id ? '#C9B6FF' : '#A89FC2',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'border-color .15s, background .15s',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '3px' }}>{p.label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>{p.preco}</div>
                    <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.7 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Nome */}
            <div>
              <label style={labelStyle}>Nome completo *</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Seu nome"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>E-mail *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="seu@email.com.br"
                style={inputStyle}
              />
            </div>

            {/* Empresa */}
            <div>
              <label style={labelStyle}>Empresa</label>
              <input
                type="text"
                value={form.empresa}
                onChange={(e) => set('empresa', e.target.value)}
                placeholder="Nome da empresa"
                style={inputStyle}
              />
            </div>

            {/* Telefone */}
            <div>
              <label style={labelStyle}>Telefone / WhatsApp</label>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
                placeholder="(61) 99999-9999"
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ color: '#FF7A59', fontSize: '13px', margin: 0, padding: '10px 12px', background: 'rgba(255,122,89,.08)', borderRadius: '8px', border: '1px solid rgba(255,122,89,.2)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#6B50CC' : '#9D6FFF',
                color: '#170F2B',
                fontWeight: 700,
                fontSize: '15px',
                padding: '13px',
                borderRadius: '9px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '4px',
                transition: 'background .15s',
              }}
            >
              {loading ? 'Enviando...' : 'Solicitar acesso'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#6E6390' }}>
            Já tem conta?{' '}
            <Link to="/login" style={{ color: '#9D6FFF', textDecoration: 'none', fontWeight: 600 }}>
              Entrar
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#A89FC2',
  marginBottom: '6px',
  letterSpacing: '.02em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#201935',
  border: '1px solid #2E2548',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#F1EDFA',
  outline: 'none',
  boxSizing: 'border-box',
}

import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Email ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-page)' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .lg-flex { display: none !important; }
        @media (min-width: 1024px) { .lg-flex { display: flex !important; } .lg-hide { display: none !important; } }
      `}</style>

      {/* Left — brand panel */}
      <div className="lg-flex" style={{
        width: '44%', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px', flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative gradient orb */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-ring) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <img src="/favicon.svg" alt="NexusIT" width="44" height="44" style={{ flexShrink: 0, filter: 'drop-shadow(0 6px 20px var(--accent-glow))' }} />
          <span style={{ color: 'var(--sidebar-text-hover)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>NexusIT</span>
        </div>

        {/* Hero text */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ color: 'var(--sidebar-text-hover)', fontSize: 38, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Infraestrutura<br />sob controle.
          </h1>
          <p style={{ color: 'var(--sidebar-text)', fontSize: 15, lineHeight: 1.7, marginBottom: 44, maxWidth: 340 }}>
            Centralize monitoramento, inventário, chamados e documentação da sua equipe de TI.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { label: 'Monitoramento Zabbix',  desc: 'Hosts e alertas em tempo real', color: 'var(--accent)' },
              { label: 'Chamados GLPI',          desc: 'Gestão completa de tickets',    color: 'var(--green)' },
              { label: 'Inventário e Sistemas',  desc: 'Controle de equipamentos',      color: 'var(--amber)' },
              { label: 'Planejamento Kanban',    desc: 'Tarefas organizadas por sprint', color: 'var(--purple)' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, flexShrink: 0, boxShadow: `0 0 8px ${f.color}` }} />
                <div>
                  <p style={{ color: 'var(--sidebar-text-hover)', fontSize: 13.5, fontWeight: 500, lineHeight: 1 }}>{f.label}</p>
                  <p style={{ color: 'var(--sidebar-label)', fontSize: 12, marginTop: 3 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'var(--sidebar-label)', fontSize: 12, position: 'relative', zIndex: 1 }}>© 2026 NexusIT · Painel Interno de TI</p>
      </div>

      {/* Right — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: 380 }} className="fade-up">

          {/* Mobile logo */}
          <div className="lg-hide" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
            <img src="/favicon.svg" alt="NexusIT" width="40" height="40" style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 14px var(--accent-glow))' }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>NexusIT</span>
          </div>

          {/* Header */}
          <div style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>Bem-vindo</h2>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 5 }}>Entre com suas credenciais corporativas</p>
          </div>

          {/* Form card */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--r-2xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', padding: '32px 30px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="input-label">Email corporativo</label>
                <input
                  type="email" required autoComplete="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="voce@empresa.com.br"
                  className="input"
                  style={{ height: 42 }}
                />
              </div>

              <div>
                <label className="input-label">Senha</label>
                <input
                  type="password" required autoComplete="current-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input"
                  style={{ height: 42 }}
                />
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13, padding: '11px 13px', borderRadius: 'var(--r-md)' }}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', height: 44, fontSize: 14, fontWeight: 600, marginTop: 4, borderRadius: 'var(--r-lg)' }}>
                {loading ? (
                  <>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Entrando...
                  </>
                ) : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

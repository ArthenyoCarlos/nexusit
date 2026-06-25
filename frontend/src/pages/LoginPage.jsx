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
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0c1322' }}>

      {/* Left — brand */}
      <div style={{ width: '42%', display: 'none', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        className="lg-flex">
        <style>{`.lg-flex { display: flex !important; } @media (max-width: 1023px) { .lg-flex { display: none !important; } }`}</style>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>NexusIT</span>
        </div>

        {/* Hero text */}
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: 36, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: 14 }}>
            Infraestrutura<br />sob controle.
          </h1>
          <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.65, marginBottom: 40, maxWidth: 340 }}>
            Centralize monitoramento, inventário, chamados e documentação da sua equipe de TI.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Monitoramento Zabbix',  desc: 'Hosts e alertas em tempo real' },
              { label: 'Chamados GLPI',          desc: 'Gestão completa de tickets' },
              { label: 'Inventário e Sistemas',  desc: 'Controle de equipamentos' },
              { label: 'Planejamento Kanban',    desc: 'Tarefas organizadas por sprint' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                <div>
                  <p style={{ color: '#cbd5e1', fontSize: 13.5, fontWeight: 500, lineHeight: 1 }}>{f.label}</p>
                  <p style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: '#334155', fontSize: 12 }}>© 2026 NexusIT · Painel Interno de TI</p>
      </div>

      {/* Right — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--bg-page)' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }} className="lg-hide">
            <style>{`.lg-hide { display: none !important; } @media (max-width: 1023px) { .lg-hide { display: flex !important; } }`}</style>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 17 }}>NexusIT</span>
          </div>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Entrar na conta</h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Use suas credenciais corporativas de acesso</p>
          </div>

          {/* Card */}
          <div className="card" style={{ padding: '28px 28px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="input-label">Email corporativo</label>
                <input
                  type="email" required autoComplete="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="voce@empresa.com.br"
                  className="input"
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
                />
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: 13, padding: '10px 12px', borderRadius: 'var(--r-md)' }}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 2 }}>
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

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  )
}

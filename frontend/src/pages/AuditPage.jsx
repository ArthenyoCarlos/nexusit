import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { getAuditEvents } from '../services/audit'

const PERIOD_OPTIONS = [
  { value: 1, label: 'Hoje' },
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
]

const MODULE_LABELS = {
  VAULT: 'Cofre',
  SSH_CONSOLE: 'Console SSH',
  NEXUSDESK: 'NexusDesk',
}
const MODULE_BADGE = {
  VAULT: 'badge-amber',
  SSH_CONSOLE: 'badge-blue',
  NEXUSDESK: 'badge-green',
}

const ACTION_LABELS = {
  REVEAL_SECRET: 'Revelou senha',
  CONNECT: 'Conectou',
  HOST_KEY_MISMATCH: 'Chave do host mudou (alerta)',
}

export default function AuditPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const [moduleFilter, setModuleFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAuditEvents({ days, module: moduleFilter || undefined })
      setEvents(data)
    } catch { setEvents([]) }
    finally { setLoading(false) }
  }, [days, moduleFilter])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (!isAdmin) {
    return (
      <Layout>
        <div className="page fade-up">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Central de Auditoria</h1>
              <p>Acesso restrito a administradores</p>
            </div>
          </div>
          <div className="card empty-state">
            <h3>Você não tem permissão para acessar a Auditoria</h3>
            <p>Esta área é restrita a administradores.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Central de Auditoria</h1>
            <p>Registro de acessos sensíveis: Cofre, Console SSH e NexusDesk</p>
          </div>
        </div>

        <div className="filter-bar">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="input" style={{ width: 'auto', height: 32 }}>
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os módulos</option>
            {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 'var(--r-md)' }} />)}
          </div>
        ) : events.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3>Nenhum evento no período</h3>
            <p>Nenhum acesso sensível foi registrado com esses filtros</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  {['Quando', 'Módulo', 'Ação', 'Quem', 'Alvo', 'Detalhes'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(ev.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${MODULE_BADGE[ev.module] || 'badge-gray'}`} style={{ fontSize: 11 }}>
                        {MODULE_LABELS[ev.module] || ev.module}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: ev.action === 'HOST_KEY_MISMATCH' ? 'var(--red)' : 'var(--text-primary)', fontWeight: ev.action === 'HOST_KEY_MISMATCH' ? 600 : 400 }}>
                      {ACTION_LABELS[ev.action] || ev.action}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>{ev.actorName || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>{ev.targetLabel || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)' }}>{ev.details || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}

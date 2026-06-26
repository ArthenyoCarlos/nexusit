import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Badge from '../components/Badge'
import { getSystem } from '../services/systems'
import { getProblems } from '../services/monitoring'
import ReactMarkdown from 'react-markdown'

export default function SystemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [system, setSystem]   = useState(null)
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([getSystem(id), getProblems()])
      .then(([sysRes, alertsRes]) => {
        if (sysRes.status === 'fulfilled') setSystem(sysRes.value)
        else setError('Sistema não encontrado.')
        if (alertsRes.status === 'fulfilled') {
          const problems = alertsRes.value?.data ?? []
          setAlerts(problems)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const serverAlerts = system?.server
    ? alerts.filter(p => p.hostName?.toLowerCase() === system.server.name?.toLowerCase())
    : []

  const SEVERITY = {
    5: { label: 'Disaster', color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
    4: { label: 'High',     color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    3: { label: 'Average',  color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    2: { label: 'Warning',  color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
    1: { label: 'Info',     color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  }

  if (loading) return (
    <Layout>
      <div className="page fade-up">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
        </div>
      </div>
    </Layout>
  )

  if (error || !system) return (
    <Layout>
      <div className="page">
        <button onClick={() => navigate(-1)} className="btn btn-default btn-sm" style={{ marginBottom: 16 }}>← Voltar</button>
        <div className="card empty-state"><h3>{error || 'Sistema não encontrado.'}</h3></div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="page fade-up">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <button onClick={() => navigate(-1)} className="btn btn-default btn-sm" style={{ marginBottom: 8 }}>← Voltar</button>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {system.name}
              <Badge value={system.status} />
            </h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Badge value={system.category} />
            </div>
          </div>
          {system.url && (
            <a href={system.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Acessar Sistema ↗
            </a>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Informações Gerais */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Informações</h3>
            <dl style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['URL', system.url ? <a href={system.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{system.url}</a> : '—'],
                ['Categoria', system.category],
                ['Responsável', system.responsible?.name ?? '—'],
                ['Servidor vinculado', system.server?.name ?? '—'],
                ['Status', <Badge key="st" value={system.status} />],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 8 }}>
                  <dt style={{ fontSize: 12.5, color: 'var(--text-tertiary)', minWidth: 140, flexShrink: 0 }}>{label}</dt>
                  <dd style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Alertas Zabbix */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
              Alertas Zabbix
              {system.server
                ? <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6, textTransform: 'none', fontSize: 12 }}>— {system.server.name}</span>
                : <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6, textTransform: 'none', fontSize: 12 }}>— sem servidor vinculado</span>
              }
            </h3>
            {!system.server ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nenhum servidor vinculado a este sistema.</p>
            ) : serverAlerts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}>
                <span style={{ fontSize: 18 }}>✓</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Nenhum alerta ativo</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {serverAlerts.map(p => {
                  const s = SEVERITY[p.severity] || SEVERITY[1]
                  return (
                    <div key={p.id} className={`${s.bg} ${s.border}`}
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <span className={`${s.color}`} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</span>
                        <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{p.name}</p>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        {new Date(p.clock * 1000).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Descrição */}
          {system.description && (
            <div className="card" style={{ padding: '20px 24px', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Descrição</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.7 }}>{system.description}</p>
            </div>
          )}

          {/* Documentação */}
          {system.documentation && (
            <div className="card" style={{ padding: '20px 24px', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Documentação</h3>
              <div className="prose" style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                <ReactMarkdown>{system.documentation}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

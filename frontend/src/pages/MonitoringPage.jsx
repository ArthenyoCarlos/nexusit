import { useState, useEffect, useCallback } from 'react'
import { getHosts, getProblems, getHostMetrics } from '../services/monitoring'
import Layout from '../components/Layout'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const SEV = {
  5: { label: 'Disaster', pill: 'bg-red-100 text-red-700',     dot: 'bg-red-500',    ring: 'border-red-200 bg-red-50'    },
  4: { label: 'High',     pill: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', ring: 'border-orange-200 bg-orange-50' },
  3: { label: 'Average',  pill: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', ring: 'border-yellow-200 bg-yellow-50' },
  2: { label: 'Warning',  pill: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',   ring: 'border-blue-200 bg-blue-50'  },
  1: { label: 'Info',     pill: 'bg-slate-100 text-slate-600',  dot: 'bg-slate-400',  ring: 'border-slate-200 bg-slate-50' },
  0: { label: 'N/C',      pill: 'bg-slate-100 text-slate-500',  dot: 'bg-slate-300',  ring: 'border-slate-200 bg-slate-50' },
}

function formatUptime(s) {
  if (!s) return '—'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`
}
function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function MonitoringPage() {
  const [hosts, setHosts]           = useState([])
  const [problems, setProblems]     = useState([])
  const [metrics, setMetrics]       = useState(null)
  const [chartHostId, setChartHostId] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [hostsRes, problemsRes] = await Promise.all([getHosts(), getProblems()])
      setHosts(hostsRes.data)
      setProblems(problemsRes.data)
      setLastUpdate(new Date())
      if (!chartHostId) {
  	const first = hostsRes.data.find(h => h.available)
  	if (first) {
    	  setChartHostId(first.id)
    	  const m = await getHostMetrics(first.id)
    	  setMetrics(m.data)
  	}
  } else {
  const m = await getHostMetrics(chartHostId)
  setMetrics(m.data)
}
    } catch {}
    finally { setLoading(false) }
  }, [chartHostId])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 60_000)
    return () => clearInterval(t)
  }, [fetchData])

  const grouped = Object.entries(
    problems.reduce((acc, p) => { (acc[p.severity] ??= []).push(p); return acc }, {})
  ).sort(([a], [b]) => b - a)

  const online = hosts.filter(h => h.available).length
  const offline = hosts.length - online
  const cpuData = (metrics?.cpuHistory ?? []).map(p => ({ time: formatTime(p.timestamp), cpu: +p.value.toFixed(1) }))

  return (
    <Layout>
      <div className="page">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1>Monitoramento</h1>
            <p>Integração Zabbix — atualização a cada 60s</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
            {lastUpdate && <span>Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? '#f59e0b' : '#10b981', display: 'inline-block', animation: loading ? 'pulse 1.5s infinite' : 'none' }} />
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Hosts',    value: hosts.length,    iconColor: '#1a56db', iconBg: 'var(--accent-light)' },
            { label: 'Online',         value: online,          iconColor: 'var(--green)',  iconBg: 'var(--green-bg)'  },
            { label: 'Offline',        value: offline,         iconColor: offline > 0 ? 'var(--red)' : 'var(--text-tertiary)', iconBg: offline > 0 ? 'var(--red-bg)' : 'var(--bg-muted)' },
            { label: 'Alertas Ativos', value: problems.length, iconColor: problems.length > 0 ? 'var(--amber)' : 'var(--green)', iconBg: problems.length > 0 ? 'var(--amber-bg)' : 'var(--green-bg)' },
          ].map(c => (
            <div key={c.label} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="stat-icon" style={{ background: c.iconBg, color: c.iconColor }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                </svg>
              </div>
              <div>
                <div className="stat-value" style={{ color: c.iconColor, fontSize: 24 }}>{c.value}</div>
                <div className="stat-label">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Hosts grid */}
        <section style={{ marginBottom: 24 }}>
          <p className="label-caps" style={{ marginBottom: 12 }}>Hosts</p>
          {loading && hosts.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 10 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 88, borderRadius: 'var(--r-lg)' }} />
              ))}
            </div>
          ) : hosts.length === 0 ? (
            <div className="card empty-state">
              <h3>Nenhum host encontrado</h3>
              <p>Verifique a configuração do Zabbix.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 10 }}>
              {hosts.map(host => (
                <button key={host.id} onClick={async () => {
                  setChartHostId(host.id)
                  const res = await getHostMetrics(host.id)
                  setMetrics(res.data)
                }}
                  className="card"
                  style={{ padding: '14px 16px', textAlign: 'left', width: '100%', cursor: 'pointer', border: host.id === chartHostId ? '2px solid var(--accent)' : '1px solid var(--border)', transition: 'all 0.15s', background: host.id === chartHostId ? 'var(--accent-light)' : 'var(--bg-surface)' }}
                  onMouseEnter={e => { if (host.id !== chartHostId) { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: host.available ? '#10b981' : '#ef4444', display: 'inline-block' }} />
                    <span className={host.available ? 'badge badge-green' : 'badge badge-red'} style={{ fontSize: 11 }}>
                      {host.available ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{host.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{host.ip || '—'}</p>
                  {host.uptimeSeconds != null && (
                    <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>↑ {formatUptime(host.uptimeSeconds)}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* CPU Chart */}
        {metrics && (
          <section className="card p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  CPU — {hosts.find(h => h.id === chartHostId)?.name ?? '—'}
                </h2>
                <p className="text-xs text-slate-400">Últimas 2 horas</p>
              </div>
              <div className="flex gap-4 text-sm">
                {metrics.cpuPercent != null && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-blue-600">{metrics.cpuPercent.toFixed(1)}%</p>
                    <p className="text-xs text-slate-400">CPU</p>
                  </div>
                )}
                {metrics.memoryUsedPercent != null && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-purple-600">{metrics.memoryUsedPercent.toFixed(1)}%</p>
                    <p className="text-xs text-slate-400">Memória</p>
                  </div>
                )}
                {metrics.uptimeSeconds != null && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-600">{formatUptime(metrics.uptimeSeconds)}</p>
                    <p className="text-xs text-slate-400">Uptime</p>
                  </div>
                )}
              </div>
            </div>
            {cpuData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={cpuData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0,0,0,0.08)' }}
                    formatter={v => [`${v}%`, 'CPU']}
                  />
                  <Line type="monotone" dataKey="cpu" stroke="#3b82f6" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm text-center py-8">Sem dados de histórico disponíveis.</p>
            )}
          </section>
        )}

        {/* Alertas */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <p className="label-caps">Alertas Ativos</p>
            {problems.length > 0 && <span className="badge badge-red">{problems.length}</span>}
          </div>
          {problems.length === 0 ? (
            <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--green)' }}>
                <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--green)' }}>Tudo operacional</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 3 }}>Nenhum alerta ativo no momento</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {grouped.map(([sev, probs]) => {
                const s = SEV[sev] ?? SEV[0]
                return (
                  <div key={sev} className="card" style={{ overflow: 'hidden', border: `1px solid ${s.ring.includes('red') ? 'var(--red-border)' : s.ring.includes('orange') ? 'var(--amber-border)' : 'var(--border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-muted)', background: 'var(--bg-subtle)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot.includes('red') ? 'var(--red)' : s.dot.includes('orange') ? 'var(--amber)' : s.dot.includes('yellow') ? '#ca8a04' : 'var(--text-tertiary)', display: 'inline-block', flexShrink: 0 }} />
                      <span className="badge badge-red" style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, fontSize: 12 }}>{s.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{probs.length} {probs.length === 1 ? 'alerta' : 'alertas'}</span>
                    </div>
                    <div>
                      {probs.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--border-muted)' : 'none' }}>
                          <div>
                            <p style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.hostName}</p>
                          </div>
                          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 16 }}>
                            {new Date(p.clock * 1000).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}

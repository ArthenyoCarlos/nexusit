import { useState, useEffect, useCallback } from 'react'
import { getHosts, getProblems, getHostMetrics } from '../services/monitoring'
import Layout from '../components/Layout'
import MetricChartCard from '../components/MetricChartCard'
import { severityOf } from '../utils/severity'

function formatUptime(s) {
  if (!s) return '—'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`
}
function formatTime(ts, hours) {
  return hours > 2
    ? new Date(ts * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function formatBytes(v) {
  if (v == null) return '—'
  if (v >= 1e9) return (v / 1e9).toFixed(1) + ' GB'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + ' MB'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + ' KB'
  return Math.round(v) + ' B'
}

const PERIODS = [
  { label: '2h', hours: 2 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
]


export default function MonitoringPage() {
  const [hosts, setHosts]           = useState([])
  const [problems, setProblems]     = useState([])
  const [metrics, setMetrics]       = useState(null)
  const [chartHostId, setChartHostId] = useState(null)
  const [metricsHours, setMetricsHours] = useState(2)
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
    	  const m = await getHostMetrics(first.id, metricsHours)
    	  setMetrics(m.data)
  	}
  } else {
  const m = await getHostMetrics(chartHostId, metricsHours)
  setMetrics(m.data)
}
    } catch {}
    finally { setLoading(false) }
  }, [chartHostId, metricsHours])

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
  const cpuData = (metrics?.cpuHistory ?? []).map(p => ({ time: formatTime(p.timestamp, metricsHours), cpu: +p.value.toFixed(1) }))
  const memData = (metrics?.memoryHistory ?? []).map(p => ({ time: formatTime(p.timestamp, metricsHours), mem: +p.value.toFixed(1) }))
  const diskData = (metrics?.diskHistory ?? []).map(p => ({ time: formatTime(p.timestamp, metricsHours), disk: +p.value.toFixed(1) }))
  const tempData = (metrics?.temperatureHistory ?? []).map(p => ({ time: formatTime(p.timestamp, metricsHours), temp: +p.value.toFixed(1) }))
  const netByTime = new Map()
  ;(metrics?.networkInHistory ?? []).forEach(p => {
    netByTime.set(p.timestamp, { ...(netByTime.get(p.timestamp) || {}), ts: p.timestamp, time: formatTime(p.timestamp, metricsHours), in: p.value })
  })
  ;(metrics?.networkOutHistory ?? []).forEach(p => {
    netByTime.set(p.timestamp, { ...(netByTime.get(p.timestamp) || {}), ts: p.timestamp, time: formatTime(p.timestamp, metricsHours), out: p.value })
  })
  const netData = Array.from(netByTime.values()).sort((a, b) => a.ts - b.ts)
  const periodLabel = metricsHours <= 2 ? 'Últimas 2 horas' : metricsHours <= 24 ? 'Últimas 24 horas' : 'Últimos 7 dias'

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
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? 'var(--amber)' : 'var(--green)', display: 'inline-block', animation: loading ? 'pulse 1.5s infinite' : 'none' }} />
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Hosts',    value: hosts.length,    iconColor: 'var(--accent-text)', iconBg: 'var(--accent-light)' },
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
                  const res = await getHostMetrics(host.id, metricsHours)
                  setMetrics(res.data)
                }}
                  className="card"
                  style={{ padding: '14px 16px', textAlign: 'left', width: '100%', cursor: 'pointer', border: host.id === chartHostId ? '2px solid var(--accent)' : '1px solid var(--border)', transition: 'all 0.15s', background: host.id === chartHostId ? 'var(--accent-light)' : 'var(--bg-surface)' }}
                  onMouseEnter={e => { if (host.id !== chartHostId) { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: host.available ? 'var(--green)' : 'var(--red)', display: 'inline-block' }} />
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

        {/* Métricas do host selecionado */}
        {metrics && (
          <section style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {hosts.find(h => h.id === chartHostId)?.name ?? '—'}
                </h2>
                <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  {periodLabel}{metrics.uptimeSeconds != null ? ` · ↑ ${formatUptime(metrics.uptimeSeconds)}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-muted)', padding: 3, borderRadius: 'var(--r-md)' }}>
                {PERIODS.map(p => (
                  <button key={p.hours} onClick={() => setMetricsHours(p.hours)}
                    style={{
                      padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                      background: metricsHours === p.hours ? 'var(--bg-surface)' : 'transparent',
                      color: metricsHours === p.hours ? 'var(--accent-text)' : 'var(--text-tertiary)',
                      boxShadow: metricsHours === p.hours ? 'var(--shadow-sm)' : 'none',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
              <MetricChartCard title="CPU" color="var(--accent-text)"
                valueLabel={metrics.cpuPercent != null ? `${metrics.cpuPercent.toFixed(1)}%` : null}
                data={cpuData} series={[{ dataKey: 'cpu', color: 'var(--accent)', label: 'CPU' }]}
                yDomain={[0, 100]} yFormatter={v => `${v}%`} />
              <MetricChartCard title="Memória" color="var(--purple)"
                valueLabel={metrics.memoryUsedPercent != null ? `${metrics.memoryUsedPercent.toFixed(1)}%` : null}
                data={memData} series={[{ dataKey: 'mem', color: 'var(--purple)', label: 'Memória' }]}
                yDomain={[0, 100]} yFormatter={v => `${v}%`} />
              <MetricChartCard title="Disco (C:)" color="var(--cyan)"
                valueLabel={metrics.diskUsedPercent != null ? `${metrics.diskUsedPercent.toFixed(1)}%` : null}
                data={diskData} series={[{ dataKey: 'disk', color: 'var(--cyan)', label: 'Disco' }]}
                yDomain={[0, 100]} yFormatter={v => `${v}%`} />
              <MetricChartCard title="Rede (download/upload)"
                note="Valor bruto do Zabbix — pode ser taxa ou contador acumulado."
                data={netData}
                series={[{ dataKey: 'in', color: 'var(--green)', label: 'Download' }, { dataKey: 'out', color: 'var(--orange)', label: 'Upload' }]}
                yFormatter={formatBytes} />
              {metrics.temperatureCelsius != null && (
                <MetricChartCard title="Temperatura" color="var(--red)"
                  valueLabel={`${metrics.temperatureCelsius.toFixed(1)}°C`}
                  note="Sensor ACPI via WMI — só disponível em notebooks com esse sensor exposto pelo BIOS/Windows."
                  data={tempData} series={[{ dataKey: 'temp', color: 'var(--red)', label: 'Temperatura' }]}
                  yFormatter={v => `${v}°C`} />
              )}
            </div>
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
                const s = severityOf(Number(sev))
                return (
                  <div key={sev} className="card" style={{ overflow: 'hidden', border: `1px solid ${s.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-muted)', background: 'var(--bg-subtle)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 12, color: s.color }}>{s.label}</span>
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

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { getHosts, getProblems } from '../services/monitoring'
import { getTickets } from '../services/glpi'
import { getSystems } from '../services/systems'
import { getLicenses } from '../services/licenses'
import { getContracts } from '../services/contracts'
import { getMonitors } from '../services/urlmonitor'
import { getInventory } from '../services/inventory'
import { severityOf } from '../utils/severity'

function greet(name) {
  const h = new Date().getHours()
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${s}, ${name?.split(' ')[0] ?? 'usuário'}`
}

const LIC_STATUS = {
  EXPIRED:       { label: 'Vencida',        color: 'var(--red)'    },
  EXPIRING_SOON: { label: 'Vence em breve', color: 'var(--orange)' },
  EXPIRING:      { label: 'A vencer',       color: 'var(--amber)'  },
  OK:            { label: 'OK',             color: 'var(--green)'  },
}

function computeHealthScore({ problems, tickets, licenses, contracts, monitors }) {
  let score = 100
  const crit   = (problems  || []).filter(p => Number(p.severity) >= 4)
  const warn   = (problems  || []).filter(p => Number(p.severity) < 4)
  const open   = (tickets   || []).filter(t => ![5, 6].includes(Number(t.status)))
  const critTx = open.filter(t => Number(t.priority) >= 4)
  const expLic = (licenses  || []).filter(l => l.status === 'EXPIRED' || l.status === 'EXPIRING_SOON')
  const expCtr = (contracts || []).filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON')
  const down   = (monitors  || []).filter(m => m.enabled && m.lastStatus != null && m.lastStatus >= 400)

  score -= Math.min(crit.length   * 10, 30)
  score -= Math.min(warn.length   *  3, 12)
  score -= Math.min(critTx.length *  5, 15)
  score -= Math.min(open.length   *  1,  8)
  score -= Math.min(expLic.length *  5, 15)
  score -= Math.min(expCtr.length *  5, 15)
  score -= Math.min(down.length   * 10, 20)
  return Math.max(0, Math.min(score, 100))
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState({
    hosts: null, online: null, problems: [],
    tickets: [], systems: null, licenses: [],
    contracts: [], monitors: [], inventory: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getHosts(), getProblems(), getSystems({}),
      getTickets(null), getLicenses(), getContracts(), getMonitors(), getInventory(),
    ]).then(([hostsR, probR, sysR, tickR, licR, ctrR, monR, invR]) => {
      const hosts     = hostsR.status === 'fulfilled' ? hostsR.value.data    : []
      const problems  = probR.status  === 'fulfilled' ? probR.value.data     : []
      const systems   = sysR.status   === 'fulfilled' ? sysR.value           : []
      const tickets   = tickR.status  === 'fulfilled' ? tickR.value.data     : []
      const licenses  = licR.status   === 'fulfilled' ? licR.value           : []
      const contracts = ctrR.status   === 'fulfilled' ? ctrR.value           : []
      const monitors  = monR.status   === 'fulfilled' ? monR.value           : []
      const inventory = invR.status   === 'fulfilled' ? invR.value           : []
      setData({
        hosts: hosts.length, online: hosts.filter(h => h.available).length,
        problems, systems: systems.length, tickets, licenses, contracts, monitors, inventory,
      })
      setLoading(false)
    })
  }, [])

  const dateStr        = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const availPct       = data.hosts ? Math.round((data.online / data.hosts) * 100) : null
  const allAlerts      = data.problems.sort((a, b) => b.severity - a.severity)
  const expiringLics   = data.licenses
    .filter(l => l.status === 'EXPIRED' || l.status === 'EXPIRING_SOON' || l.status === 'EXPIRING')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 5)
  const expiringCtrs   = data.contracts
    .filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON' || c.status === 'EXPIRING')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 5)
  const urlsDown       = data.monitors.filter(m => m.enabled && m.lastStatus != null && m.lastStatus >= 400).length
  const urlsUp         = data.monitors.filter(m => m.enabled && m.lastStatus != null && m.lastStatus < 400).length
  const invActive      = data.inventory.filter(i => i.status === 'ACTIVE').length
  const invMaint       = data.inventory.filter(i => i.status === 'MAINTENANCE').length
  const invInact       = data.inventory.filter(i => i.status === 'INACTIVE').length
  const openTickets    = data.tickets.filter(t => t.status !== 'closed' && t.status !== 'solved')
  const recentTickets  = [...data.tickets].slice(0, 5)
  const healthScore    = loading ? null : computeHealthScore({
    problems: data.problems, tickets: data.tickets, licenses: data.licenses,
    contracts: data.contracts, monitors: data.monitors,
  })

  const scoreColor = healthScore == null ? 'var(--text-tertiary)'
    : healthScore >= 80 ? 'var(--green)'
    : healthScore >= 60 ? 'var(--amber)'
    : healthScore >= 40 ? 'var(--orange)'
    : 'var(--red)'
  const scoreBg = healthScore == null ? 'var(--bg-muted)'
    : healthScore >= 80 ? 'var(--green-bg)'
    : healthScore >= 60 ? 'var(--amber-bg)'
    : healthScore >= 40 ? 'var(--orange-bg)'
    : 'var(--red-bg)'
  const scoreLabel = healthScore == null ? '—'
    : healthScore >= 80 ? 'Operação saudável'
    : healthScore >= 60 ? 'Atenção necessária'
    : healthScore >= 40 ? 'Situação crítica'
    : 'Operação comprometida'

  return (
    <Layout>
      <div className="page fade-up">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1>{greet(user?.name)}</h1>
            <p style={{ textTransform: 'capitalize' }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/hermes" className="btn btn-primary btn-sm">
              <IcoHermes /> Perguntar ao Hermes
            </Link>
            <a href="/dashboard/tv" target="_blank" rel="noopener noreferrer" className="btn btn-default btn-sm">
              <IcoTv /> Dashboard TV
            </a>
          </div>
        </div>

        {/* Health Score */}
        <div style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: '14px 20px', background: scoreBg, borderColor: scoreColor + '40' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: 'var(--bg-surface)', border: `3px solid ${scoreColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
              }}>
                {loading ? (
                  <div className="skeleton" style={{ width: 32, height: 16, borderRadius: 4 }} />
                ) : (
                  <>
                    <span style={{ fontSize: 17, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{healthScore}</span>
                    <span style={{ fontSize: 9, color: scoreColor, fontWeight: 600 }}>/ 100</span>
                  </>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: scoreColor, marginBottom: 2 }}>
                  Score de Saúde da TI {loading ? '—' : `· ${scoreLabel}`}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Calculado com base em alertas Zabbix, chamados, licenças e URLs monitoradas.
                </p>
              </div>
              <Link to="/hermes" style={{ fontSize: 12, color: scoreColor, textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>
                Analisar com Hermes →
              </Link>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <KpiCard icon={<IcoHosts />}    label="Hosts monitorados" value={data.hosts ?? '—'}  color="var(--accent-text)" bg="var(--accent-light)"  to="/monitoring" />
          <KpiCard icon={<IcoOnline />}   label="Hosts online"      value={data.online ?? '—'} color="var(--green)" bg="var(--green-bg)"      to="/monitoring"
            sub={availPct !== null ? `${availPct}% disponíveis` : undefined} />
          <KpiCard icon={<IcoAlert />}    label="Alertas ativos"    value={data.problems.length ?? '—'} color={data.problems.length > 0 ? 'var(--red)' : 'var(--green)'} bg={data.problems.length > 0 ? 'var(--red-bg)' : 'var(--green-bg)'} to="/monitoring" />
          <KpiCard icon={<IcoTicket />}   label="Chamados abertos"  value={openTickets.length ?? '—'} color="var(--amber)" bg="var(--amber-bg)" to="/tickets" />
          <KpiCard icon={<IcoSystem />}   label="Sistemas"          value={data.systems ?? '—'} color="var(--purple)" bg="var(--purple-bg)"    to="/systems" />
          <KpiCard icon={<IcoInventory/>} label="Inventário"        value={data.inventory.length ?? '—'} color="var(--cyan)" bg="var(--cyan-bg)" to="/inventory"
            sub={invMaint > 0 ? `${invMaint} em manutenção` : undefined} />
        </div>

        {/* Attention Cards */}
        {!loading && (expiringLics.length > 0 || expiringCtrs.length > 0 || urlsDown > 0) && (
          <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {urlsDown > 0 && (
              <Link to="/url-monitor" style={{ textDecoration: 'none', flex: '1 1 180px' }}>
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--r-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', margin: 0 }}>{urlsDown} URL(s) com falha</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>Monitor de URLs</p>
                  </div>
                </div>
              </Link>
            )}
            {expiringCtrs.filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON').map(c => (
              <Link key={c.id} to="/contracts" style={{ textDecoration: 'none', flex: '1 1 220px' }}>
                <div style={{ background: c.status === 'EXPIRED' ? 'var(--red-bg)' : 'var(--amber-bg)', border: `1px solid ${c.status === 'EXPIRED' ? 'var(--red-border)' : 'var(--amber-border)'}`, borderRadius: 'var(--r-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'EXPIRED' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: c.status === 'EXPIRED' ? 'var(--red)' : 'var(--amber)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Contrato: {c.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                      {c.status === 'EXPIRED' ? 'Vencido' : `Vence em ${c.daysUntilExpiry}d`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
            {expiringLics.filter(l => l.status === 'EXPIRED' || l.status === 'EXPIRING_SOON').slice(0, 2).map(l => (
              <Link key={l.id} to="/licenses" style={{ textDecoration: 'none', flex: '1 1 220px' }}>
                <div style={{ background: l.status === 'EXPIRED' ? 'var(--red-bg)' : 'var(--amber-bg)', border: `1px solid ${l.status === 'EXPIRED' ? 'var(--red-border)' : 'var(--amber-border)'}`, borderRadius: 'var(--r-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.status === 'EXPIRED' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: l.status === 'EXPIRED' ? 'var(--red)' : 'var(--amber)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Licença: {l.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                      {l.status === 'EXPIRED' ? 'Vencida' : `Vence em ${l.daysUntilExpiry}d`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Main grid: 2 columns */}
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 360px)', gap: 16, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

            {/* Alertas Zabbix */}
            <Section title="Alertas Zabbix" count={allAlerts.length} to="/monitoring" emptyMsg="Nenhum alerta ativo">
              {allAlerts.slice(0, 6).map(p => {
                const s   = severityOf(p.severity)
                const ago = p.clock ? timeAgo(Number(p.clock)) : null
                return (
                  <div key={p.problemid} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border-muted)' }}>
                    <span style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, flexShrink: 0, minWidth: 70 }}>
                      {s.label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3 }}>{p.name}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{p.hostName ?? p.hosts?.[0]?.host}{ago ? ` · ${ago}` : ''}</p>
                    </div>
                  </div>
                )
              })}
            </Section>

            {/* Chamados GLPI */}
            <Section title="Chamados GLPI" count={data.tickets.length} to="/tickets" emptyMsg="Nenhum chamado aberto">
              {recentTickets.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-muted)' }}>
                  <TicketStatusDot status={t.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      #{t.id} {t.name || t.title}
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{ticketStatusLabel(t.status)} · {t.requester ?? 'Solicitante'}</p>
                  </div>
                </div>
              ))}
            </Section>

          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

            {/* Inventário por status */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Inventário</p>
                <Link to="/inventory" style={{ fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none' }}>Ver tudo →</Link>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'Ativos',     value: invActive, color: 'var(--green)' },
                  { label: 'Manutenção', value: invMaint,  color: 'var(--amber)' },
                  { label: 'Inativos',   value: invInact,  color: 'var(--text-tertiary)' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', background: 'var(--bg-muted)', borderRadius: 8, padding: '10px 4px' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {data.inventory.length > 0 && (
                <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-muted)', overflow: 'hidden', display: 'flex' }}>
                  {invActive > 0 && <div style={{ flex: invActive, background: 'var(--green)' }} />}
                  {invMaint  > 0 && <div style={{ flex: invMaint,  background: 'var(--amber)' }} />}
                  {invInact  > 0 && <div style={{ flex: invInact,  background: 'var(--text-tertiary)' }} />}
                </div>
              )}
            </div>

            {/* Monitor URLs */}
            {data.monitors.length > 0 && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Monitor de URLs</p>
                  <Link to="/url-monitor" style={{ fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none' }}>Ver tudo →</Link>
                </div>
                {urlsDown > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--red-bg)', borderRadius: 'var(--r-sm)', marginBottom: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                    <p style={{ fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>{urlsDown} URL(s) com falha</p>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.monitors.filter(m => m.enabled).slice(0, 6).map(m => {
                    const ok      = m.lastStatus != null && m.lastStatus < 400
                    const noCheck = m.lastStatus == null
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: noCheck ? 'var(--text-tertiary)' : ok ? 'var(--green)' : 'var(--red)' }} />
                        <p style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                          {noCheck ? '—' : ok ? `${m.uptimePct ?? '—'}%` : m.lastStatus}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Licenças a vencer */}
            {expiringLics.length > 0 && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Licenças a Vencer</p>
                  <Link to="/licenses" style={{ fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none' }}>Ver tudo →</Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {expiringLics.map(l => {
                    const s = LIC_STATUS[l.status] ?? LIC_STATUS.OK
                    return (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</p>
                          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{l.vendor ?? '—'}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{l.status === 'EXPIRED' ? 'Vencida' : `${l.daysUntilExpiry}d`}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l.expiryDate ? new Date(l.expiryDate).toLocaleDateString('pt-BR') : '—'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Contratos a vencer */}
            {expiringCtrs.length > 0 && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Contratos a Vencer</p>
                  <Link to="/contracts" style={{ fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none' }}>Ver tudo →</Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {expiringCtrs.map(c => {
                    const color = c.status === 'EXPIRED' ? 'var(--red)' : c.status === 'EXPIRING_SOON' ? 'var(--orange)' : 'var(--amber)'
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{c.vendor ?? '—'}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color }}>{c.status === 'EXPIRED' ? 'Vencido' : `${c.daysUntilExpiry}d`}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.endDate ? new Date(c.endDate).toLocaleDateString('pt-BR') : '—'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  )
}

function Section({ title, count, to, emptyMsg, children }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
          {count > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-muted)', color: 'var(--text-secondary)', borderRadius: 99, padding: '1px 7px' }}>{count}</span>}
        </div>
        <Link to={to} style={{ fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none' }}>Ver tudo →</Link>
      </div>
      {!count
        ? <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>{emptyMsg}</p>
        : <div>{children}</div>
      }
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color, bg, to }) {
  const inner = (
    <div className="stat-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div className="stat-icon" style={{ background: bg, color, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  )
  return to
    ? <Link to={to} style={{ display: 'block', textDecoration: 'none' }}>{inner}</Link>
    : <div>{inner}</div>
}

function TicketStatusDot({ status }) {
  const colors = { new: 'var(--red)', assigned: 'var(--amber)', pending: 'var(--accent)', solved: 'var(--green)', closed: 'var(--text-tertiary)' }
  return <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status] ?? 'var(--text-tertiary)', flexShrink: 0 }} />
}

function ticketStatusLabel(s) {
  const m = { new: 'Novo', assigned: 'Atribuído', pending: 'Pendente', solved: 'Resolvido', closed: 'Fechado' }
  return m[s] ?? s
}

function timeAgo(unixSec) {
  const diff = Math.floor(Date.now() / 1000) - unixSec
  if (diff < 60)    return `${diff}s atrás`
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

const si = { width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24', strokeLinecap: 'round', strokeLinejoin: 'round' }
function IcoHosts()     { return <svg {...si}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> }
function IcoOnline()    { return <svg {...si}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> }
function IcoAlert()     { return <svg {...si}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function IcoTicket()    { return <svg {...si}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg> }
function IcoSystem()    { return <svg {...si}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 21h12M12 17v4"/><path d="M7 9h.01M11 9h.01M15 9h.01"/></svg> }
function IcoInventory() { return <svg {...si}><path d="M3 6l9-3 9 3v12l-9 3-9-3V6z"/><path d="M12 3v18M3 6l9 3 9-3"/></svg> }
function IcoTv()        { return <svg {...si}><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg> }
function IcoHermes()    { return <svg {...si}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }

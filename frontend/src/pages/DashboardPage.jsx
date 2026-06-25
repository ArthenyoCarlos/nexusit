import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { getHosts, getProblems } from '../services/monitoring'
import { getTickets } from '../services/glpi'
import { getSystems } from '../services/systems'

function greet(name) {
  const h = new Date().getHours()
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${s}, ${name?.split(' ')[0] ?? 'usuário'}`
}

const COLORS = {
  blue:   { icon: '#1a56db', bg: 'var(--accent-light)', dot: '#93c5fd' },
  green:  { icon: '#0e9f6e', bg: 'var(--green-bg)',    dot: '#6ee7b7' },
  red:    { icon: '#e02424', bg: 'var(--red-bg)',       dot: '#fca5a5' },
  amber:  { icon: '#d97706', bg: 'var(--amber-bg)',     dot: '#fcd34d' },
  purple: { icon: '#7c3aed', bg: 'var(--purple-bg)',    dot: '#c4b5fd' },
}

function StatCard({ icon, label, value, sub, color, to }) {
  const c = COLORS[color] ?? COLORS.blue
  const inner = (
    <div className="stat-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div className="stat-icon" style={{ background: c.bg, color: c.icon, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: c.icon, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  )
  return to
    ? <Link to={to} style={{ display: 'block', textDecoration: 'none' }}>{inner}</Link>
    : <div>{inner}</div>
}

const SHORTCUTS = [
  { label: 'Monitoramento',  path: '/monitoring', desc: 'Hosts e alertas Zabbix',        Icon: IconMonitor  },
  { label: 'Chamados GLPI',  path: '/tickets',    desc: 'Tickets de suporte abertos',    Icon: IconTicket   },
  { label: 'Sistemas',       path: '/systems',    desc: 'Catálogo de sistemas internos',  Icon: IconSystems  },
  { label: 'Inventário',     path: '/inventory',  desc: 'Equipamentos cadastrados',       Icon: IconInventory},
  { label: 'Rede',           path: '/network',    desc: 'Documentação de infraestrutura', Icon: IconNetwork  },
  { label: 'Planejamento',   path: '/planning',   desc: 'Kanban da equipe de TI',         Icon: IconPlanning },
  { label: 'Anotações',      path: '/notes',      desc: 'Notas pessoais e compartilhadas',Icon: IconNotes    },
  { label: 'Perfil',         path: '/profile',    desc: 'Configurações da sua conta',     Icon: IconUser     },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ hosts: null, online: null, alerts: null, systems: null, tickets: null })

  useEffect(() => {
    Promise.allSettled([getHosts(), getProblems(), getSystems({}), getTickets(null)])
      .then(([hostsR, problemsR, systemsR, ticketsR]) => {
        const hosts    = hostsR.status    === 'fulfilled' ? hostsR.value.data    : []
        const problems = problemsR.status === 'fulfilled' ? problemsR.value.data : []
        const systems  = systemsR.status  === 'fulfilled' ? systemsR.value       : []
        const tickets  = ticketsR.status  === 'fulfilled' ? ticketsR.value.data  : []
        setStats({ hosts: hosts.length, online: hosts.filter(h => h.available).length, alerts: problems.length, systems: systems.length, tickets: tickets.length })
      })
  }, [])

  const dateStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const availPct = stats.hosts ? Math.round((stats.online / stats.hosts) * 100) : null

  return (
    <Layout>
      <div className="page fade-up">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1>{greet(user?.name)}</h1>
            <p style={{ textTransform: 'capitalize' }}>{dateStr}</p>
          </div>
          <a href="/dashboard/tv" target="_blank" rel="noopener noreferrer" className="btn btn-default btn-sm">
            <IcoTv /> Dashboard TV
          </a>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard icon={<IcoHosts />}   label="Hosts monitorados"  value={stats.hosts   ?? '—'} color="blue"   to="/monitoring" />
          <StatCard icon={<IcoOnline />}  label="Hosts online"       value={stats.online  ?? '—'} color="green"  to="/monitoring"
            sub={availPct !== null ? `${availPct}% disponíveis` : undefined} />
          <StatCard icon={<IcoAlert />}   label="Alertas ativos"     value={stats.alerts  ?? '—'} color={stats.alerts > 0 ? 'red' : 'green'} to="/monitoring" />
          <StatCard icon={<IcoTicket />}  label="Chamados abertos"   value={stats.tickets ?? '—'} color="amber"  to="/tickets" />
          <StatCard icon={<IcoSystem />}  label="Sistemas"           value={stats.systems ?? '—'} color="purple" to="/systems" />
        </div>

        {/* Shortcuts */}
        <div>
          <p className="label-caps" style={{ marginBottom: 12 }}>Acesso rápido</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
            {SHORTCUTS.map(({ label, path, desc, Icon }) => (
              <Link key={path} to={path} style={{ display: 'block', textDecoration: 'none' }}>
                <div className="card card-hover" style={{ padding: '16px 18px' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 10 }}>
                    <Icon />
                  </div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

const si = { width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24', strokeLinecap: 'round', strokeLinejoin: 'round' }
function IcoHosts()    { return <svg {...si}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> }
function IcoOnline()   { return <svg {...si}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> }
function IcoAlert()    { return <svg {...si}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function IcoTicket()   { return <svg {...si}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg> }
function IcoSystem()   { return <svg {...si}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 21h12M12 17v4"/><path d="M7 9h.01M11 9h.01M15 9h.01"/></svg> }
function IcoTv()       { return <svg {...si}><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg> }
function IconMonitor() { return <svg {...si}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> }
function IconTicket()  { return <svg {...si}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg> }
function IconSystems() { return <svg {...si}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 21h12M12 17v4"/><path d="M7 9h.01M11 9h.01M15 9h.01"/></svg> }
function IconInventory(){ return <svg {...si}><path d="M3 6l9-3 9 3v12l-9 3-9-3V6z"/><path d="M12 3v18M3 6l9 3 9-3"/></svg> }
function IconNetwork() { return <svg {...si}><circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><path d="M6 6h4M14 6h4M6 18h4M14 18h4M12 10v2M10 12H6M18 12h-4"/></svg> }
function IconPlanning(){ return <svg {...si}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg> }
function IconNotes()   { return <svg {...si}><path d="M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg> }
function IconUser()    { return <svg {...si}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }

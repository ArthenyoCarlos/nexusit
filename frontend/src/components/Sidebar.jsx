import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  {
    section: 'Principal',
    items: [
      { label: 'Dashboard',     path: '/dashboard',  Icon: IconDashboard  },
      { label: 'Dash. Executivo', path: '/dashboard/executive', Icon: IconExecutive, adminOnly: true },
      { label: 'NexusAI',       path: '/hermes',     Icon: IconHermes     },
      { label: 'Monitoramento', path: '/monitoring', Icon: IconMonitor    },
    ],
  },
  {
    section: 'Infraestrutura',
    items: [
      { label: 'Sistemas',      path: '/systems',    Icon: IconSystems    },
      { label: 'Inventário',    path: '/inventory',  Icon: IconInventory  },
      { label: 'Rede',          path: '/network',    Icon: IconNetwork    },
    ],
  },
  {
    section: 'Suporte',
    items: [
      { label: 'Chamados',      path: '/tickets',     Icon: IconTicket     },
      { label: 'Anotações',     path: '/notes',       Icon: IconNotes      },
      { label: 'Planejamento',  path: '/planning',    Icon: IconPlanning   },
      { label: 'Onboarding',    path: '/onboarding',  Icon: IconOnboarding },
    ],
  },
  {
    section: 'Ferramentas',
    items: [
      { label: 'Cofre',         path: '/vault',                Icon: IconVault, adminOnly: true },
      { label: 'Licenças',      path: '/licenses',             Icon: IconLicense    },
      { label: 'Contratos',     path: '/contracts',            Icon: IconContract   },
      { label: 'Termos Resp.',   path: '/termos',               Icon: IconContract   },
      { label: 'Monitor URLs',  path: '/url-monitor',          Icon: IconMonitorUrl },
      { label: 'Manutenção',    path: '/maintenance-schedule', Icon: IconSchedule   },
      { label: 'Wiki',          path: '/wiki',                 Icon: IconWiki       },
      { label: 'Financeiro',    path: '/financial',            Icon: IconFinancial  },
    ],
  },
]

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const initials = user?.name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() ?? 'U'

  return (
    <aside onClick={onNavigate} style={{
      width: 'var(--sidebar-w)',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden', flexShrink: 0,
    }}>

      {/* Logo */}
      <div style={{ padding: '14px 12px 12px', borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 'var(--r-md)', flexShrink: 0,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px var(--accent-glow)',
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--text-inverse)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <p style={{ color: 'var(--sidebar-text-hover)', fontWeight: 700, fontSize: 14, lineHeight: 1, letterSpacing: '-0.01em', fontFamily: 'var(--font-mono)' }}>NexusIT</p>
            <p style={{ color: 'var(--sidebar-label)', fontSize: 10.5, marginTop: 2.5 }}>Painel de TI</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" style={{ flex: 1, padding: '8px 7px', overflowY: 'auto' }}>
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: 10 }}>
            <p style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: 'var(--sidebar-label)',
              padding: '0 6px', marginBottom: 2,
            }}>
              {group.section}
            </p>
            {group.items.filter(item => !item.adminOnly || isAdmin).map(({ label, path, Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <Icon />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid var(--sidebar-border)', padding: '6px 7px 10px', flexShrink: 0 }}>
        {isAdmin && (
          <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <IconSettings />
            <span>Configurações</span>
          </NavLink>
        )}

        <NavLink to="/profile" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          style={{ marginTop: 2 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9.5, fontWeight: 700, color: 'var(--text-inverse)', fontFamily: 'var(--font-mono)',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--sidebar-text-hover)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>{user?.name}</p>
            <p style={{ fontSize: 10, color: 'var(--sidebar-label)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
          </div>
        </NavLink>

        <button onClick={logout} className="nav-item" style={{ width: '100%', marginTop: 1 }}>
          <IconLogout />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}

const i = { width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, viewBox: '0 0 24 24', strokeLinecap: 'round', strokeLinejoin: 'round' }
function IconDashboard()  { return <svg {...i}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> }
function IconMonitor()    { return <svg {...i}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> }
function IconSystems()    { return <svg {...i}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 21h12M12 17v4"/><circle cx="7" cy="10" r="1"/><circle cx="12" cy="10" r="1"/></svg> }
function IconInventory()  { return <svg {...i}><path d="M3 6l9-3 9 3v12l-9 3-9-3V6z"/><path d="M12 3v18M3 6l9 3 9-3"/></svg> }
function IconNetwork()    { return <svg {...i}><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M12 11l-5.5 6M12 11l5.5 6"/></svg> }
function IconTicket()     { return <svg {...i}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z"/></svg> }
function IconNotes()      { return <svg {...i}><path d="M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg> }
function IconPlanning()   { return <svg {...i}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg> }
function IconSettings()   { return <svg {...i}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> }
function IconLogout()     { return <svg {...i}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg> }
function IconVault()      { return <svg {...i}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/></svg> }
function IconLicense()    { return <svg {...i}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> }
function IconOnboarding() { return <svg {...i}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> }
function IconMonitorUrl() { return <svg {...i}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg> }
function IconContract()   { return <svg {...i}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5M8 9h2"/></svg> }
function IconSchedule()   { return <svg {...i}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="15" r="2"/></svg> }
function IconWiki()       { return <svg {...i}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M9 9h6M9 13h4"/></svg> }
function IconFinancial()  { return <svg {...i}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> }
function IconHermes()     { return <svg {...i}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function IconExecutive()  { return <svg {...i}><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-4"/></svg> }

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { getProblems } from '../services/monitoring'
import { getTickets } from '../services/glpi'
import { getMine } from '../services/support'
import { playAlertSound, unlockAlertSound } from '../utils/alertSound'
import { requestNotificationPermission, showDesktopNotification } from '../utils/desktopNotify'

function problemKey(p) {
  return String(p.id ?? p.problemid ?? p.eventid ?? `${p.hostName}:${p.name}:${p.clock}`)
}

export default function Layout({ children }) {
  const { add: addToast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [isNavOpen, setIsNavOpen] = useState(false)
  const prevProblemIdsRef = useRef(null)
  const prevTicketIdsRef = useRef(null)
  const prevMessageAtRef = useRef(null)
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname

  useEffect(() => { setIsNavOpen(false) }, [location.pathname])

  useEffect(() => {
    const unlock = () => { unlockAlertSound(); requestNotificationPermission() }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    async function poll() {
      try {
        const [problemsRes, ticketsRes] = await Promise.allSettled([getProblems(), getTickets(null)])
        const currentProblems = problemsRes.status === 'fulfilled' ? (problemsRes.value.data ?? []) : []
        const currentTickets = ticketsRes.status === 'fulfilled' ? (ticketsRes.value.data ?? []) : []

        if (prevProblemIdsRef.current === null) {
          prevProblemIdsRef.current = new Set(currentProblems.map(problemKey))
          prevTicketIdsRef.current = new Set(currentTickets.map(t => String(t.id)))
          return
        }

        const newProblems = currentProblems.filter(
          p => !prevProblemIdsRef.current.has(problemKey(p)) && Number(p.severity) >= 4
        )
        const newTickets = currentTickets.filter(t => !prevTicketIdsRef.current.has(String(t.id)))

        newProblems.forEach(p => {
          addToast(`Alerta Zabbix: ${p.name} [${p.hostName ?? 'host'}]`, 'error')
          playAlertSound(Number(p.severity))
          showDesktopNotification('Alerta Zabbix', {
            body: `${p.name} [${p.hostName ?? 'host'}]`,
            tag: `zabbix-${problemKey(p)}`,
            onClick: () => navigate('/monitoring'),
          })
        })

        if (newTickets.length > 0) {
          const newest = newTickets[0]
          addToast(`Novo chamado GLPI #${newest.id}: ${newest.title ?? newest.name ?? 'sem título'}`, 'warning')
          playAlertSound(Number(newest.priority) >= 4 ? 4 : 3)
          showDesktopNotification(`Novo chamado #${newest.id}`, {
            body: newest.title ?? newest.name ?? 'sem título',
            tag: `ticket-${newest.id}`,
            onClick: () => navigate('/tickets'),
          })
        }

        prevProblemIdsRef.current = new Set(currentProblems.map(problemKey))
        prevTicketIdsRef.current = new Set(currentTickets.map(t => String(t.id)))
      } catch {}
    }
    poll()
    const t = setInterval(poll, 60_000)
    return () => clearInterval(t)
  }, [addToast])

  useEffect(() => {
    async function pollMessages() {
      try {
        const conversations = await getMine()
        const isBootstrap = prevMessageAtRef.current === null
        const lastAtByConversation = isBootstrap ? new Map() : prevMessageAtRef.current

        conversations.forEach(c => {
          if (!c.lastMessageAt) return
          const prevAt = lastAtByConversation.get(c.id)
          const isNew = !isBootstrap && prevAt !== c.lastMessageAt && c.lastMessageAuthor !== 'TECH'
          if (isNew) {
            const from = c.contactName || c.contactPhone || 'cliente'
            // Quando já está no CRM, a própria tela cuida do som da conversa aberta —
            // evita tocar duas vezes para a mesma mensagem.
            if (pathnameRef.current !== '/support-crm') {
              addToast(`Nova mensagem de ${from}`, 'info')
              playAlertSound(3)
            }
            showDesktopNotification(`Nova mensagem — ${from}`, {
              body: c.lastMessagePreview || 'Enviou uma mensagem',
              tag: `support-message-${c.id}`,
              onClick: () => navigate('/support-crm'),
            })
          }
          lastAtByConversation.set(c.id, c.lastMessageAt)
        })

        prevMessageAtRef.current = lastAtByConversation
      } catch {}
    }
    pollMessages()
    const t = setInterval(pollMessages, 15_000)
    return () => clearInterval(t)
  }, [addToast, navigate])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>

      {/* Backdrop mobile */}
      <div className={`nav-backdrop${isNavOpen ? ' open' : ''}`} onClick={() => setIsNavOpen(false)} />

      {/* Sidebar fixo / drawer mobile */}
      <div className={`app-sidebar-wrap${isNavOpen ? ' open' : ''}`} style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 40 }}>
        <Sidebar onNavigate={() => setIsNavOpen(false)} />
      </div>

      {/* Conteúdo principal */}
      <div className="app-content" style={{ flex: 1, minWidth: 0, marginLeft: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 9,
          background: 'color-mix(in srgb, var(--bg-page) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-muted)',
          padding: '0 28px',
          height: 54,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <button
            className="mobile-nav-toggle"
            onClick={() => setIsNavOpen(o => !o)}
            aria-label="Abrir menu"
            style={{
              alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>

          <div style={{ flex: 1 }} />

          <GlobalSearch />

          <button
            onClick={toggleTheme}
            aria-label="Alternar tema claro/escuro"
            title={theme === 'dark' ? 'Ver no claro' : 'Ver no escuro'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 'var(--r-md)', flexShrink: 0,
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
          </button>

          <NotificationBell />
        </header>

        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

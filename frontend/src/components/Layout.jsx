import { useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import { useToast } from '../contexts/ToastContext'
import { getProblems } from '../services/monitoring'
import { getTickets } from '../services/glpi'
import { playAlertSound, unlockAlertSound } from '../utils/alertSound'

function problemKey(p) {
  return String(p.id ?? p.problemid ?? p.eventid ?? `${p.hostName}:${p.name}:${p.clock}`)
}

export default function Layout({ children }) {
  const { add: addToast } = useToast()
  const prevProblemIdsRef = useRef(null)
  const prevTicketIdsRef = useRef(null)

  useEffect(() => {
    const unlock = () => unlockAlertSound()
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
        })

        if (newTickets.length > 0) {
          const newest = newTickets[0]
          addToast(`Novo chamado GLPI #${newest.id}: ${newest.title ?? newest.name ?? 'sem título'}`, 'warning')
          playAlertSound(Number(newest.priority) >= 4 ? 4 : 3)
        }

        prevProblemIdsRef.current = new Set(currentProblems.map(problemKey))
        prevTicketIdsRef.current = new Set(currentTickets.map(t => String(t.id)))
      } catch {}
    }
    poll()
    const t = setInterval(poll, 60_000)
    return () => clearInterval(t)
  }, [addToast])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>

      {/* Sidebar fixo */}
      <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10 }}>
        <Sidebar />
      </div>

      {/* Conteúdo principal */}
      <div style={{ flex: 1, minWidth: 0, marginLeft: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 9,
          background: 'rgba(244,246,250,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-muted)',
          padding: '0 28px',
          height: 54,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
        }}>
          <GlobalSearch />
          <NotificationBell />
        </header>

        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

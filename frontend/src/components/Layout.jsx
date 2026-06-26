import { useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import { useToast } from '../contexts/ToastContext'
import { getProblems } from '../services/monitoring'

export default function Layout({ children }) {
  const { add: addToast } = useToast()
  const prevIdsRef = useRef(null)

  useEffect(() => {
    async function poll() {
      try {
        const { data } = await getProblems()
        const current = data ?? []
        if (prevIdsRef.current === null) {
          prevIdsRef.current = new Set(current.map(p => p.problemid))
          return
        }
        const newProblems = current.filter(
          p => !prevIdsRef.current.has(p.problemid) && Number(p.severity) >= 4
        )
        newProblems.forEach(p =>
          addToast(`Alerta Zabbix: ${p.name} [${p.hostName ?? 'host'}]`, 'error')
        )
        prevIdsRef.current = new Set(current.map(p => p.problemid))
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

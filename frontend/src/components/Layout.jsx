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
      <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10 }}>
        <Sidebar />
      </div>
      <div style={{ flex: 1, minWidth: 0, marginLeft: 224, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 9, background: 'var(--bg-page)', borderBottom: '1px solid var(--border-muted)', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <GlobalSearch />
          <NotificationBell />
        </div>
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

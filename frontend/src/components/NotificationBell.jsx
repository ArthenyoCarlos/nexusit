import { useState, useEffect, useRef } from 'react'
import { getProblems } from '../services/monitoring'
import { getTickets } from '../services/glpi'

export default function NotificationBell() {
  const [alerts, setAlerts]     = useState([])
  const [tickets, setTickets]   = useState([])
  const [open, setOpen]         = useState(false)
  const prevAlertIds = useRef(null)
  const bellRef = useRef(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [alertsRes, ticketsRes] = await Promise.allSettled([getProblems(), getTickets(null)])
        if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data ?? [])
        if (ticketsRes.status === 'fulfilled') setTickets(ticketsRes.value.data ?? [])
      } catch {}
    }
    fetch()
    const interval = setInterval(fetch, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const criticalAlerts = alerts.filter(a => a.severity >= 4)
  const totalCount = criticalAlerts.length + (tickets.length > 0 ? 1 : 0)

  const SEVERITY = { 5: { label: 'Disaster', color: '#dc2626' }, 4: { label: 'High', color: '#ea580c' }, 3: { label: 'Average', color: '#d97706' }, 2: { label: 'Warning', color: '#2563eb' }, 1: { label: 'Info', color: '#64748b' } }

  return (
    <div ref={bellRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', borderRadius: 8 }}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {totalCount > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: '50%', background: criticalAlerts.length > 0 ? '#dc2626' : '#d97706', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 320, background: 'var(--bg-card)', border: '1px solid var(--border-muted)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-muted)' }}>
            <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Notificações</p>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {criticalAlerts.length === 0 && tickets.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>✓ Tudo tranquilo</p>
              </div>
            )}
            {criticalAlerts.map(a => {
              const s = SEVERITY[a.severity] || SEVERITY[1]
              return (
                <div key={a.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-muted)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: s.color }}>{s.label}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.hostName}</p>
                  </div>
                </div>
              )
            })}
            {tickets.length > 0 && (
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-muted)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: 'var(--text-primary)' }}><strong>{tickets.length}</strong> chamado(s) GLPI aberto(s)</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

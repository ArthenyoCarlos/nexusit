import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlertsSummary } from '../services/alerts'

const SEVERITY_STYLE = {
  critical: { color: 'var(--red)', bg: 'var(--red-bg)', label: 'Crítico' },
  warning:  { color: 'var(--amber)', bg: 'var(--amber-bg)', label: 'Atenção' },
  info:     { color: 'var(--accent)', bg: 'var(--accent-light)', label: 'Info' },
}

export default function NotificationBell() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const bellRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetch = async () => {
      try {
        const summary = await getAlertsSummary()
        setItems(summary.items ?? [])
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

  const actionable = items.filter(i => i.severity !== 'info')
  const totalCount = actionable.length
  const hasCritical = items.some(i => i.severity === 'critical')

  function goTo(path) {
    setOpen(false)
    if (path) navigate(path)
  }

  return (
    <div ref={bellRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', cursor: 'pointer',
          width: 34, height: 34, borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? 'var(--bg-muted)' : 'var(--bg-surface)',
          border: '1.5px solid var(--border)', color: 'var(--text-secondary)',
          boxShadow: 'var(--shadow-xs)', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-muted)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {totalCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 17, height: 17, borderRadius: 99,
            background: hasCritical ? 'var(--red)' : 'var(--amber)',
            color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid var(--bg-page)',
          }}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340, maxWidth: 'calc(100vw - 24px)', background: 'var(--bg-surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-xl)', zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Central de Alertas</p>
            {totalCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: hasCritical ? 'var(--red-bg)' : 'var(--amber-bg)', color: hasCritical ? 'var(--red)' : 'var(--amber)' }}>
                {totalCount} alerta{totalCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 && (
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 22, marginBottom: 8 }}>✅</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Tudo tranquilo</p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>Nenhum alerta ativo no momento</p>
              </div>
            )}
            {items.map((it, i) => {
              const s = SEVERITY_STYLE[it.severity] || SEVERITY_STYLE.info
              return (
                <button key={i} onClick={() => goTo(it.path)}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 18px', borderBottom: '1px solid var(--border-muted)', display: 'flex', gap: 12, alignItems: 'flex-start', background: 'none', border: 'none', cursor: it.path ? 'pointer' : 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${s.color}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, marginTop: 2 }}>{it.message}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

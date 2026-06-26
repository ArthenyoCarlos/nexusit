import { useEffect } from 'react'

const SIZE_MAP = { sm: 400, md: 520, lg: 720, xl: 900 }

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto', background: 'rgba(12,19,34,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--r-xl)', width: '100%', maxWidth: SIZE_MAP[size] ?? 520, margin: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px -12px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-muted)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)
export function useToast() { return useContext(ToastContext) }

const CONFIG = {
  info:    { accent: '#6366f1', icon: 'ℹ', bg: '#1e1b4b' },
  success: { accent: '#059669', icon: '✓', bg: '#052e16' },
  warning: { accent: '#d97706', icon: '⚠', bg: '#1c1003' },
  error:   { accent: '#dc2626', icon: '🔔', bg: '#1f0707' },
}

function Toast({ toast, onRemove }) {
  const c = CONFIG[toast.type] ?? CONFIG.info
  return (
    <div className="fade-in" style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '13px 16px', borderRadius: 'var(--r-lg)',
      background: c.bg, color: '#f1f5f9',
      border: `1px solid ${c.accent}33`,
      boxShadow: `0 20px 48px rgba(0,0,0,0.5), 0 0 0 1px ${c.accent}22`,
      minWidth: 290, maxWidth: 380,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1, color: c.accent }}>{c.icon}</span>
      <p style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5, color: '#e2e8f0' }}>{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} style={{
        color: '#64748b', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: -1,
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.color = '#f1f5f9' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#64748b' }}
      >×</button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const remove = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), [])
  const add = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => remove(id), 6000)
  }, [remove])

  return (
    <ToastContext.Provider value={{ add, remove }}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <Toast toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

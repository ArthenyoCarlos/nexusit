import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)
export function useToast() { return useContext(ToastContext) }

const CONFIG = {
  info:    { accent: 'var(--accent-text)', icon: 'ℹ', bg: 'var(--accent-light)' },
  success: { accent: 'var(--green)',       icon: '✓', bg: 'var(--green-bg)'  },
  warning: { accent: 'var(--amber)',       icon: '⚠', bg: 'var(--amber-bg)' },
  error:   { accent: 'var(--red)',         icon: '🔔', bg: 'var(--red-bg)'   },
}

function Toast({ toast, onRemove }) {
  const c = CONFIG[toast.type] ?? CONFIG.info
  return (
    <div className="fade-in" style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '13px 16px', borderRadius: 'var(--r-lg)',
      background: 'var(--bg-elevated)', color: 'var(--text-primary)',
      border: `1px solid ${c.accent}`,
      boxShadow: 'var(--shadow-xl)',
      minWidth: 290, maxWidth: 380,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1, color: c.accent }}>{c.icon}</span>
      <p style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} style={{
        color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: -1,
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
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

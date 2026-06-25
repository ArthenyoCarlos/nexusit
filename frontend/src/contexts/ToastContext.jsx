import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)
export function useToast() { return useContext(ToastContext) }

const CONFIG = {
  info:    { bg: 'bg-slate-800',   icon: 'ℹ️' },
  success: { bg: 'bg-emerald-600', icon: '✓'  },
  warning: { bg: 'bg-amber-500',   icon: '⚠️' },
  error:   { bg: 'bg-red-600',     icon: '🔔' },
}

function Toast({ toast, onRemove }) {
  const c = CONFIG[toast.type] ?? CONFIG.info
  return (
    <div className={`${c.bg} text-white flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl min-w-72 max-w-sm animate-fade-in`}
      style={{ boxShadow: '0 20px 40px -12px rgb(0 0 0 / 0.4)' }}>
      <span className="text-lg leading-none flex-shrink-0 mt-0.5">{c.icon}</span>
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)}
        className="text-white/60 hover:text-white text-xl leading-none flex-shrink-0 mt-0.5 transition-colors">
        ×
      </button>
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
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

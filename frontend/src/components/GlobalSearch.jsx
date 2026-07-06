import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../services/search'

const TYPE_ICON  = { system: '🖥️', inventory: '📦', note: '📝', wiki: '📖', contract: '📄', license: '⭐', onboarding: '👤', termo: '📋' }
const TYPE_LABEL = { system: 'Sistema', inventory: 'Inventário', note: 'Anotação', wiki: 'Wiki', contract: 'Contrato', license: 'Licença', onboarding: 'Onboarding', termo: 'Termo' }

export default function GlobalSearch() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [idx, setIdx]         = useState(-1)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const search = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const data = await globalSearch(q)
      setResults(data.hits)
      setOpen(true)
      setIdx(-1)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && idx >= 0) { navigate(results[idx].path); setOpen(false); setQuery('') }
  }

  const handleSelect = (hit) => { navigate(hit.path); setOpen(false); setQuery('') }

  return (
    <div style={{ position: 'relative', width: 280, maxWidth: 'calc(100vw - 160px)' }}>
      <div style={{ position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}
          width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Buscar... (Ctrl+K)"
          style={{
            width: '100%', paddingLeft: 34, paddingRight: 42, height: 34,
            borderRadius: 'var(--r-md)', border: '1.5px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)',
            fontSize: 13, outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: 'var(--shadow-xs)',
          }}
          onFocusCapture={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-ring)' }}
          onBlurCapture={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'var(--shadow-xs)' }}
        />
        <kbd style={{
          position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
          fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-muted)',
          border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px',
          fontFamily: 'var(--font-mono)', pointerEvents: 'none',
        }}>⌃K</kbd>
        {loading && (
          <div style={{
            position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid var(--accent)', borderTopColor: 'transparent',
            animation: 'spin 0.6s linear infinite',
          }} />
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, overflow: 'hidden',
        }}>
          {results.map((hit, i) => (
            <div key={hit.id} onMouseDown={() => handleSelect(hit)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
              background: i === idx ? 'var(--accent-light)' : 'transparent',
              borderBottom: i < results.length - 1 ? '1px solid var(--border-muted)' : 'none',
              transition: 'background 0.1s',
            }}>
              <span style={{ fontSize: 16 }}>{TYPE_ICON[hit.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{hit.title}</p>
                {hit.subtitle && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>{hit.subtitle}</p>}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 'var(--r-full)', background: 'var(--bg-muted)', color: 'var(--text-tertiary)', flexShrink: 0, letterSpacing: '0.03em' }}>{TYPE_LABEL[hit.type]}</span>
            </div>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16, zIndex: 1000 }}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>Nenhum resultado para "{query}"</p>
        </div>
      )}
    </div>
  )
}

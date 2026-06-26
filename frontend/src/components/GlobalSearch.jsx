import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../services/search'

const TYPE_ICON  = { system: '🖥️', inventory: '📦', note: '📝', wiki: '📖', contract: '📄' }
const TYPE_LABEL = { system: 'Sistema', inventory: 'Inventário', note: 'Anotação', wiki: 'Wiki', contract: 'Contrato' }

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
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

  const handleSelect = (hit) => {
    navigate(hit.path)
    setOpen(false)
    setQuery('')
  }

  return (
    <div style={{ position: 'relative', width: 260 }}>
      <div style={{ position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Buscar... (Ctrl+K)"
          style={{
            width: '100%', paddingLeft: 32, paddingRight: 10, height: 32,
            borderRadius: 8, border: '1px solid var(--border-muted)',
            background: 'var(--bg-muted)', color: 'var(--text-primary)',
            fontSize: 13, outline: 'none',
          }}
        />
        {loading && <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border-muted)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000,
          overflow: 'hidden',
        }}>
          {results.map((hit, i) => (
            <div
              key={hit.id}
              onMouseDown={() => handleSelect(hit)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
                background: i === idx ? 'var(--accent-subtle)' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid var(--border-muted)' : 'none',
              }}
            >
              <span style={{ fontSize: 16 }}>{TYPE_ICON[hit.type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{hit.title}</p>
                {hit.subtitle && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{hit.subtitle}</p>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-muted)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{TYPE_LABEL[hit.type]}</span>
            </div>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border-muted)', borderRadius: 10, padding: '14px', zIndex: 1000 }}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>Nenhum resultado para "{query}"</p>
        </div>
      )}
    </div>
  )
}

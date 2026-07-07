import { Link } from 'react-router-dom'
import { healthScoreColor } from '../utils/healthScore'

export default function HealthBreakdown({ areas }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {areas.map(a => {
        const color = a.score == null ? 'var(--text-tertiary)' : healthScoreColor(a.score)
        return (
          <Link key={a.key} to={a.to} className="card card-hover" style={{ padding: '10px 12px', textDecoration: 'none', display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{a.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{a.score == null ? '—' : a.score}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--border-muted)', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', width: `${a.score ?? 0}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{a.detail}</p>
          </Link>
        )
      })}
    </div>
  )
}

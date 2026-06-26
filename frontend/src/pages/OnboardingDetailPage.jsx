import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getChecklist, toggleItem } from '../services/onboarding'

export default function OnboardingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [toggling, setToggling]   = useState({})

  useEffect(() => {
    setLoading(true)
    getChecklist(id).then(setChecklist).finally(() => setLoading(false))
  }, [id])

  const handleToggle = async (itemId) => {
    setToggling(t => ({ ...t, [itemId]: true }))
    try {
      const updated = await toggleItem(id, itemId)
      setChecklist(updated)
    } finally { setToggling(t => { const n = {...t}; delete n[itemId]; return n }) }
  }

  if (loading) return (
    <Layout><div className="page fade-up">{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 8 }} />)}</div></Layout>
  )

  if (!checklist) return (
    <Layout><div className="page"><button onClick={() => navigate(-1)} className="btn btn-default btn-sm" style={{ marginBottom: 16 }}>← Voltar</button><div className="card empty-state"><h3>Checklist não encontrado</h3></div></div></Layout>
  )

  const pct = checklist.totalItems === 0 ? 0 : Math.round((checklist.doneItems / checklist.totalItems) * 100)
  const isOn = checklist.type === 'ONBOARDING'

  return (
    <Layout>
      <div className="page fade-up" style={{ maxWidth: 720 }}>
        <button onClick={() => navigate(-1)} className="btn btn-default btn-sm" style={{ marginBottom: 16 }}>← Voltar</button>

        <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: isOn ? '#dbeafe' : '#fce7f3', color: isOn ? '#1d4ed8' : '#be185d', display: 'inline-block', marginBottom: 8 }}>
                {isOn ? '👋 ONBOARDING' : '🚪 OFFBOARDING'}
              </span>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{checklist.employeeName}</h1>
              {checklist.department && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{checklist.department}</p>}
              {checklist.startDate && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{new Date(checklist.startDate + 'T00:00').toLocaleDateString('pt-BR')}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: pct === 100 ? 'var(--success)' : 'var(--accent)' }}>{pct}%</p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{checklist.doneItems} de {checklist.totalItems}</p>
            </div>
          </div>
          <div style={{ marginTop: 14, height: 8, background: 'var(--border-muted)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checklist.items.map(item => (
            <div key={item.id}
              className="card"
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', opacity: toggling[item.id] ? 0.5 : 1, transition: 'opacity 0.2s' }}
              onClick={() => !toggling[item.id] && handleToggle(item.id)}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: item.done ? 'none' : '2px solid var(--border-muted)',
                background: item.done ? 'var(--success)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: item.done ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none' }}>
                  {item.title}
                </p>
                {item.doneBy && (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Concluído por {item.doneBy} em {new Date(item.doneAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

import { useState, useEffect, useMemo } from 'react'
import Layout from '../components/Layout'
import { getUsers } from '../services/users'
import { getAllConversations } from '../services/support'
import { getTasks } from '../services/planning'

const PERIOD_OPTIONS = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
]

function formatDuration(ms) {
  if (ms === null || ms === undefined || ms <= 0) return '—'
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}min`
  if (hours < 24) return `${hours}h ${minutes}min`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

function timeAgo(iso) {
  if (!iso) return null
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function StatBox({ label, value, tone }) {
  const bg = tone === 'danger' ? 'var(--red-bg)' : tone === 'accent' ? 'var(--accent-light)' : 'var(--bg-muted)'
  const fg = tone === 'danger' ? 'var(--red)' : tone === 'accent' ? 'var(--accent-text)' : 'var(--text-primary)'
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: bg }}>
      <p style={{ fontSize: 17, fontWeight: 700, color: fg }}>{value}</p>
      <p style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{label}</p>
    </div>
  )
}

export default function TeamTrackingPage() {
  const [users, setUsers] = useState([])
  const [conversations, setConversations] = useState([])
  const [tasks, setTasks] = useState([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getUsers(), getAllConversations(days), getTasks()])
      .then(([u, c, t]) => {
        setUsers(u)
        setConversations(c)
        setTasks(t.data)
      })
      .catch(() => { setUsers([]); setConversations([]); setTasks([]) })
      .finally(() => setLoading(false))
  }, [days])

  const today = new Date().toISOString().slice(0, 10)

  const stats = useMemo(() => {
    return users
      .filter(u => u.active)
      .map(u => {
        const myConversations = conversations.filter(c => c.claimedById === u.id)
        const closed = myConversations.filter(c => c.state === 'CLOSED')
        const active = myConversations.filter(c => c.state === 'HUMAN_ACTIVE')
        const durations = closed
          .filter(c => c.claimedAt && c.closedAt)
          .map(c => new Date(c.closedAt) - new Date(c.claimedAt))
        const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null

        const myTasks = tasks.filter(t => t.assigneeId === u.id || t.members?.some(m => m.id === u.id))
        const doneTasks = myTasks.filter(t => t.columnName === 'Concluído')
        const overdueTasks = myTasks.filter(t => t.dueDate && t.dueDate < today && t.columnName !== 'Concluído')

        const lastActivity = [
          ...myConversations.map(c => c.claimedAt),
          ...myTasks.map(t => t.updatedAt),
        ].filter(Boolean).sort().at(-1) ?? null

        return {
          user: u,
          attended: myConversations.length,
          closed: closed.length,
          active: active.length,
          avgDuration,
          totalTasks: myTasks.length,
          doneTasks: doneTasks.length,
          overdueTasks: overdueTasks.length,
          lastActivity,
        }
      })
      .sort((a, b) => (b.attended + b.totalTasks) - (a.attended + a.totalTasks))
  }, [users, conversations, tasks, today])

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Acompanhamento de Equipe</h1>
            <p>O que cada técnico e estagiário já atendeu e concluiu — dados reais do CRM e do Planejamento</p>
          </div>
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="input" style={{ width: 'auto', height: 32 }}>
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 230, borderRadius: 12 }} />)}
          </div>
        ) : stats.length === 0 ? (
          <div className="card empty-state" style={{ padding: 24 }}><p>Nenhum usuário ativo cadastrado.</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {stats.map(s => (
              <div key={s.user.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text-primary)' }}>{s.user.name}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{s.user.jobTitle}</p>
                  </div>
                  <span className={`badge ${s.user.role === 'ADMIN' ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: 10.5 }}>
                    {s.user.role === 'ADMIN' ? 'Admin' : 'Técnico(a)'}
                  </span>
                </div>

                <div>
                  <p className="label-caps" style={{ marginBottom: 6 }}>CRM de Suporte</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <StatBox label="Atendidos" value={s.attended} />
                    <StatBox label="Fechados" value={s.closed} />
                    <StatBox label="Em atend." value={s.active} tone={s.active > 0 ? 'accent' : undefined} />
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
                    Tempo médio até fechar: <strong style={{ color: 'var(--text-secondary)' }}>{formatDuration(s.avgDuration)}</strong>
                  </p>
                </div>

                <div>
                  <p className="label-caps" style={{ marginBottom: 6 }}>Planejamento</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <StatBox label="Tarefas" value={s.totalTasks} />
                    <StatBox label="Concluídas" value={s.doneTasks} />
                    <StatBox label="Atrasadas" value={s.overdueTasks} tone={s.overdueTasks > 0 ? 'danger' : undefined} />
                  </div>
                </div>

                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-muted)', paddingTop: 10, margin: 0 }}>
                  Última atividade: {s.lastActivity ? timeAgo(s.lastActivity) : 'sem atividade registrada'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Layout from '../components/Layout'
import { getSupportDashboard } from '../services/support'

const TONE = {
  healthy: { color: 'var(--green)', bg: 'rgba(34,197,94,.10)', border: 'rgba(34,197,94,.24)' },
  warning: { color: 'var(--amber)', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.28)' },
  danger: { color: 'var(--red)', bg: 'rgba(239,68,68,.12)', border: 'rgba(239,68,68,.30)' },
  info: { color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--accent-ring)' },
  muted: { color: 'var(--text-tertiary)', bg: 'var(--bg-subtle)', border: 'var(--border-muted)' },
}

const STATE_LABEL = {
  AWAITING_NAME: 'Identificando',
  MENU: 'No menu',
  AWAITING_DESCRIPTION: 'Coletando descrição',
  PENDING_TECH: 'Na fila',
  HUMAN_ACTIVE: 'Em atendimento',
  CLOSED: 'Encerrado',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function metricTone(label, value) {
  if (label === 'Fila' && value > 0) return 'warning'
  if (label === 'Espera máx.' && value >= 60) return 'danger'
  if (label === 'Espera máx.' && value >= 15) return 'warning'
  return 'info'
}

function MetricCard({ label, value, hint, suffix = '', tone }) {
  const palette = TONE[tone || metricTone(label, Number(value) || 0)] || TONE.info
  return (
    <div className="card" style={{ padding: 16, border: `1px solid ${palette.border}`, background: `linear-gradient(135deg, ${palette.bg}, var(--bg-surface))` }}>
      <p className="label-caps">{label}</p>
      <p style={{ fontSize: 30, fontWeight: 850, color: palette.color, marginTop: 7, fontFamily: 'var(--font-mono)' }}>{value}{suffix}</p>
      {hint && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

function CountList({ title, items, empty }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <p className="label-caps" style={{ marginBottom: 12 }}>{title}</p>
      {!items?.length ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{empty}</p>
      ) : (
        <div style={{ display: 'grid', gap: 9 }}>
          {items.map(item => {
            const palette = TONE[item.tone] || TONE.muted
            return (
              <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 12, background: palette.bg, border: `1px solid ${palette.border}` }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{item.label}</span>
                <strong style={{ color: palette.color, fontFamily: 'var(--font-mono)' }}>{item.count}</strong>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AttentionCard({ item, onOpen }) {
  const palette = TONE[item.tone] || TONE.warning
  return (
    <button type="button" onClick={() => onOpen(item.conversation?.id)} className="card card-hover" style={{ textAlign: 'left', padding: 14, border: `1px solid ${palette.border}`, background: palette.bg, cursor: item.conversation?.id ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ color: palette.color, fontWeight: 800, fontSize: 13 }}>{item.title}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 4 }}>{item.subtitle}</p>
        </div>
        {item.ageMinutes != null && <span className="badge" style={{ color: palette.color, border: `1px solid ${palette.border}`, background: 'rgba(255,255,255,.06)' }}>{item.ageMinutes}min</span>}
      </div>
    </button>
  )
}

function RecentRow({ c, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(c.id)} className="card card-hover" style={{ padding: 13, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 750, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contactName || c.contactPhone}</p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 11.5, marginTop: 2 }}>
          {c.glpiTicketId ? `#${c.glpiTicketId}` : 'sem chamado'} · {STATE_LABEL[c.state] || c.state} · {timeAgo(c.lastMessageAt || c.createdAt)} atrás
        </p>
        {c.lastMessagePreview && <p style={{ color: 'var(--text-secondary)', fontSize: 12.2, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessagePreview}</p>}
      </div>
      <span className="badge badge-gray">{fmtDate(c.lastMessageAt || c.createdAt)}</span>
    </button>
  )
}

export default function SupportBotDashboardPage() {
  const navigate = useNavigate()
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      setData(await getSupportDashboard(days))
    } catch {
      setError('Não foi possível carregar o painel do bot WhatsApp.')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  const m = data?.metrics || {}
  const chartData = useMemo(() => (data?.byCategory || []).map(i => ({ name: i.label, value: i.count, tone: i.tone })), [data])
  const openCrm = (id) => navigate(id ? `/support-crm?conversation=${id}` : '/support-crm')

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Painel Bot TI</h1>
            <p>Operação do atendimento WhatsApp: fila, respostas pendentes, assuntos e produtividade</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={days} onChange={e => setDays(Number(e.target.value))} className="input" style={{ width: 150 }}>
              <option value={1}>Hoje/24h</option>
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </select>
            <button type="button" onClick={load} className="btn btn-default">Atualizar</button>
          </div>
        </div>

        {error && <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}
        {loading && !data ? (
          <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 18 }}>
              <MetricCard label="Atendimentos" value={m.total ?? 0} hint={`${data?.windowDays ?? days} dia(s)`} tone="info" />
              <MetricCard label="Hoje" value={m.today ?? 0} hint="novas conversas" tone="info" />
              <MetricCard label="Fila" value={m.queue ?? 0} hint="aguardando técnico" />
              <MetricCard label="Em atendimento" value={m.active ?? 0} hint="humano ativo" tone="healthy" />
              <MetricCard label="Mensagens 24h" value={m.messages24h ?? 0} hint="entrada e saída" tone="info" />
              <MetricCard label="Espera méd." value={m.avgWaitMinutes ?? 0} suffix="min" hint="até assumir" tone={(m.avgWaitMinutes ?? 0) > 30 ? 'warning' : 'healthy'} />
              <MetricCard label="Espera máx." value={m.oldestQueueMinutes ?? 0} suffix="min" hint="fila mais antiga" />
              <MetricCard label="Com GLPI" value={m.withTicket ?? 0} hint="chamados vinculados" tone="healthy" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, .85fr)', gap: 16, marginBottom: 18 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div>
                    <p className="label-caps">Assuntos detectados</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 3 }}>Baseado na última mensagem da conversa</p>
                  </div>
                  <span className="badge badge-gray">auto</span>
                </div>
                {chartData.length === 0 ? (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Sem dados no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 18, right: 18, top: 8, bottom: 8 }}>
                      <XAxis type="number" allowDecimals={false} stroke="var(--text-tertiary)" />
                      <YAxis type="category" dataKey="name" width={120} stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)' }} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {chartData.map((entry, idx) => <Cell key={idx} fill={(TONE[entry.tone] || TONE.info).color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <CountList title="Estado do funil" items={data?.byState} empty="Sem conversas no período." />
                <CountList title="Técnicos" items={data?.byTechnician} empty="Nenhum atendimento assumido no período." />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, .9fr) minmax(0, 1.1fr)', gap: 16 }}>
              <div className="card" style={{ padding: 16 }}>
                <p className="label-caps" style={{ marginBottom: 12 }}>Precisa de atenção</p>
                {!data?.attention?.length ? (
                  <div className="empty-state" style={{ padding: 28 }}>
                    <h3>Sem pendências críticas</h3>
                    <p>Não há fila antiga nem cliente aguardando resposta dentro das regras atuais.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {data.attention.map(item => <AttentionCard key={item.id} item={item} onOpen={openCrm} />)}
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <p className="label-caps">Atendimentos recentes</p>
                  <button type="button" onClick={() => openCrm()} className="btn btn-default btn-sm">Abrir CRM</button>
                </div>
                {!data?.recent?.length ? (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Sem atendimentos recentes.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 9 }}>
                    {data.recent.map(c => <RecentRow key={c.id} c={c} onOpen={openCrm} />)}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

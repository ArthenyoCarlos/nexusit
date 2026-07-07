import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { getHosts, getProblems } from '../services/monitoring'
import { getTickets } from '../services/glpi'
import { getLicenses } from '../services/licenses'
import { getContracts } from '../services/contracts'
import { getMonitors } from '../services/urlmonitor'
import { getInventory } from '../services/inventory'
import { getFinancialSummary } from '../services/financial'
import { computeHealthScore, computeHealthBreakdown, healthScoreColor, healthScoreBg, healthScoreLabel } from '../utils/healthScore'
import HealthBreakdown from '../components/HealthBreakdown'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const BRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

function priorityBreakdown(tickets) {
  const groups = [
    { name: 'Crítica',  test: p => p >= 5, color: 'var(--red)' },
    { name: 'Alta',     test: p => p === 4, color: 'var(--orange)' },
    { name: 'Média',    test: p => p === 3, color: 'var(--amber)' },
    { name: 'Baixa',    test: p => p <= 2, color: 'var(--accent)' },
  ]
  return groups
    .map(g => ({ name: g.name, value: tickets.filter(t => g.test(Number(t.priority))).length, color: g.color }))
    .filter(d => d.value > 0)
}

function inventoryBreakdown(inventory) {
  const groups = [
    { name: 'Ativos',      status: 'ACTIVE',      color: 'var(--green)' },
    { name: 'Manutenção',  status: 'MAINTENANCE', color: 'var(--amber)' },
    { name: 'Inativos',    status: 'INACTIVE',    color: 'var(--text-tertiary)' },
  ]
  return groups
    .map(g => ({ name: g.name, value: inventory.filter(i => i.status === g.status).length, color: g.color }))
    .filter(d => d.value > 0)
}

function DonutCard({ title, data, emptyMsg }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>{title}</p>
      {data.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>{emptyMsg}</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map(d => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function KpiTile({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getHosts(), getProblems(), getTickets(null),
      getLicenses(), getContracts(), getMonitors(), getInventory(), getFinancialSummary(),
    ]).then(([hostsR, probR, tickR, licR, ctrR, monR, invR, finR]) => {
      setData({
        hosts:     hostsR.status === 'fulfilled' ? hostsR.value.data : [],
        problems:  probR.status  === 'fulfilled' ? probR.value.data  : [],
        tickets:   tickR.status  === 'fulfilled' ? tickR.value.data  : [],
        licenses:  licR.status   === 'fulfilled' ? licR.value        : [],
        contracts: ctrR.status   === 'fulfilled' ? ctrR.value        : [],
        monitors:  monR.status   === 'fulfilled' ? monR.value        : [],
        inventory: invR.status   === 'fulfilled' ? invR.value        : [],
        financial: finR.status   === 'fulfilled' ? finR.value        : null,
      })
      setLoading(false)
    })
  }, [])

  if (loading || !data) {
    return (
      <Layout>
        <div className="page fade-up">
          <div className="page-header"><div className="page-header-left"><h1>Dashboard Executivo</h1><p>Visão gerencial consolidada da TI</p></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--r-lg)' }} />)}
          </div>
        </div>
      </Layout>
    )
  }

  const openTickets = data.tickets.filter(t => ![5, 6].includes(Number(t.status)))
  const healthScore = computeHealthScore(data)
  const healthAreas = computeHealthBreakdown(data)
  const scoreColor = healthScoreColor(healthScore)
  const scoreBg = healthScoreBg(healthScore)
  const scoreLabel = healthScoreLabel(healthScore)

  const uptimeUrls = data.monitors.filter(m => m.enabled && m.uptimePct != null)
  const avgUptime = uptimeUrls.length > 0
    ? (uptimeUrls.reduce((sum, m) => sum + m.uptimePct, 0) / uptimeUrls.length).toFixed(1)
    : null

  const totalInvestido = data.financial
    ? Number(data.financial.totalAssets ?? 0) + Number(data.financial.totalLicenses ?? 0) + Number(data.financial.totalContracts ?? 0)
    : null

  const expLic = data.licenses.filter(l => l.status === 'EXPIRED' || l.status === 'EXPIRING_SOON' || l.status === 'EXPIRING')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry).slice(0, 5)
  const expCtr = data.contracts.filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON' || c.status === 'EXPIRING')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry).slice(0, 5)

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Dashboard Executivo</h1>
            <p>Visão gerencial consolidada — atualizado agora</p>
          </div>
          <Link to="/hermes" className="btn btn-primary btn-sm">Analisar com Hermes →</Link>
        </div>

        {/* Health score */}
        <div className="card" style={{ padding: '16px 22px', background: scoreBg, borderColor: scoreColor + '40', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg-surface)', border: `3px solid ${scoreColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{healthScore}</span>
              <span style={{ fontSize: 9, color: scoreColor, fontWeight: 600 }}>/ 100</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: scoreColor }}>Score de Saúde da TI · {scoreLabel}</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {openTickets.length} chamado(s) aberto(s) · {data.problems.length} alerta(s) Zabbix · {expLic.length + expCtr.length} licença(s)/contrato(s) a vencer
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <HealthBreakdown areas={healthAreas} />
        </div>

        {/* KPIs */}
        <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          <KpiTile label="Total investido em TI" value={totalInvestido != null ? BRL(totalInvestido) : '—'} sub="ativos + licenças + contratos" />
          <KpiTile label="Contas a pagar" value={data.financial ? BRL(data.financial.pendingBills) : '—'}
            sub={data.financial?.overdueBills > 0 ? `${data.financial.overdueBills} vencida(s)` : 'em dia'}
            color={data.financial?.overdueBills > 0 ? 'var(--red)' : undefined} />
          <KpiTile label="Chamados abertos" value={openTickets.length} sub={`${data.tickets.length} no total`} />
          <KpiTile label="Uptime médio (URLs)" value={avgUptime != null ? `${avgUptime}%` : '—'} sub={`${uptimeUrls.length} monitoradas`} />
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
          <DonutCard title="Chamados abertos por prioridade" data={priorityBreakdown(openTickets)} emptyMsg="Nenhum chamado aberto" />
          <DonutCard title="Inventário por status" data={inventoryBreakdown(data.inventory)} emptyMsg="Nenhum item no inventário" />
        </div>

        {/* Expiring lists */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Licenças a vencer</p>
              <Link to="/licenses" style={{ fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none' }}>Ver tudo →</Link>
            </div>
            {expLic.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nenhuma licença a vencer.</p>
            ) : expLic.map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-muted)', fontSize: 13 }}>
                <span>{l.name}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{l.status === 'EXPIRED' ? 'Vencida' : `${l.daysUntilExpiry}d`}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Contratos a vencer</p>
              <Link to="/contracts" style={{ fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none' }}>Ver tudo →</Link>
            </div>
            {expCtr.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nenhum contrato a vencer.</p>
            ) : expCtr.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-muted)', fontSize: 13 }}>
                <span>{c.name}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{c.status === 'EXPIRED' ? 'Vencido' : `${c.daysUntilExpiry}d`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

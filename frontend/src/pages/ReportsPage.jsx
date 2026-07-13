import { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import {
  downloadWeeklyReport, downloadInventoryCsv, downloadInventoryReport,
  downloadTicketsReport, downloadFinancialReport, downloadLicensesContractsReport,
  downloadSecurityReport, downloadTeamReport, downloadMonitoringReport,
} from '../services/reports'

function ReportCard({ icon, title, description, children, onDownload, downloading, label = 'Baixar PDF' }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--accent-light)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{title}</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</p>
        </div>
      </div>
      {children}
      <button onClick={onDownload} disabled={downloading} className="btn btn-primary btn-sm" style={{ marginTop: 4, alignSelf: 'flex-start' }}>
        {downloading ? 'Gerando...' : label}
      </button>
    </div>
  )
}

export default function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [ticketDays, setTicketDays] = useState(30)
  const [financialMonths, setFinancialMonths] = useState(3)
  const [securityDays, setSecurityDays] = useState(30)
  const [teamDays, setTeamDays] = useState(30)
  const [busy, setBusy] = useState('')

  async function run(key, fn) {
    setBusy(key)
    try { await fn() } catch { /* silent */ }
    finally { setBusy('') }
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="page fade-up">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Relatórios</h1>
              <p>Acesso restrito a administradores</p>
            </div>
          </div>
          <div className="card empty-state">
            <h3>Você não tem permissão para acessar os Relatórios</h3>
            <p>Esta área é restrita a administradores.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Relatórios</h1>
            <p>Relatórios profissionais em PDF, prontos para compartilhar</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h6m-6 4h6"/></svg>}
            title="Relatório Semanal de TI"
            description="Resumo geral: inventário e licenças a vencer"
            onDownload={() => run('weekly', downloadWeeklyReport)}
            downloading={busy === 'weekly'}
          />

          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            title="Relatório de Chamados"
            description="Volume, prioridade, técnicos e tempo médio de resolução (GLPI)"
            onDownload={() => run('tickets', () => downloadTicketsReport(ticketDays))}
            downloading={busy === 'tickets'}
          >
            <select value={ticketDays} onChange={e => setTicketDays(Number(e.target.value))} className="input" style={{ height: 32, width: 'auto' }}>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </ReportCard>

          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20m5-17H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
            title="Relatório Financeiro"
            description="Contas pagas, pendentes e vencidas por categoria"
            onDownload={() => run('financial', () => downloadFinancialReport(financialMonths))}
            downloading={busy === 'financial'}
          >
            <select value={financialMonths} onChange={e => setFinancialMonths(Number(e.target.value))} className="input" style={{ height: 32, width: 'auto' }}>
              <option value={1}>Último mês</option>
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>
          </ReportCard>

          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V8z"/><path d="M14 2v6h6"/></svg>}
            title="Relatório de Licenças e Contratos"
            description="Todas as licenças e contratos, valores e vencimentos"
            onDownload={() => run('lc', downloadLicensesContractsReport)}
            downloading={busy === 'lc'}
          />

          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}
            title="Relatório de Inventário"
            description="Todos os ativos cadastrados, por status e valor total"
            onDownload={() => run('inventory', downloadInventoryReport)}
            downloading={busy === 'inventory'}
          />

          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4v16h16M8 16l3-4 3 3 4-6"/></svg>}
            title="Inventário (planilha CSV)"
            description="Exportação bruta para abrir no Excel/Sheets"
            onDownload={() => run('csv', downloadInventoryCsv)}
            downloading={busy === 'csv'}
            label="Baixar CSV"
          />

          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            title="Relatório de Segurança"
            description="Eventos de auditoria: Cofre, Console SSH e NexusDesk"
            onDownload={() => run('security', () => downloadSecurityReport(securityDays))}
            downloading={busy === 'security'}
          >
            <select value={securityDays} onChange={e => setSecurityDays(Number(e.target.value))} className="input" style={{ height: 32, width: 'auto' }}>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </ReportCard>

          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
            title="Relatório de Equipe"
            description="Produtividade por pessoa: chamados, tempo médio e tarefas"
            onDownload={() => run('team', () => downloadTeamReport(teamDays))}
            downloading={busy === 'team'}
          >
            <select value={teamDays} onChange={e => setTeamDays(Number(e.target.value))} className="input" style={{ height: 32, width: 'auto' }}>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </ReportCard>

          <ReportCard
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
            title="Relatório de Monitoramento"
            description="Problemas ativos do Zabbix e disponibilidade das URLs monitoradas"
            onDownload={() => run('monitoring', downloadMonitoringReport)}
            downloading={busy === 'monitoring'}
          />
        </div>
      </div>
    </Layout>
  )
}

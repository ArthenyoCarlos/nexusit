import api from './api'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const downloadInventoryCsv = () =>
  api.get('/reports/inventory/csv', { responseType: 'blob' })
    .then(r => triggerDownload(r.data, 'inventario.csv'))

export const downloadWeeklyReport = () =>
  api.get('/reports/weekly', { responseType: 'blob' })
    .then(r => triggerDownload(r.data, 'relatorio-semanal.pdf'))

export const downloadTicketsReport = (days) =>
  api.get('/reports/tickets/pdf', { params: { days }, responseType: 'blob' })
    .then(r => triggerDownload(r.data, `relatorio-chamados-${days}d.pdf`))

export const downloadFinancialReport = (months) =>
  api.get('/reports/financial/pdf', { params: { months }, responseType: 'blob' })
    .then(r => triggerDownload(r.data, `relatorio-financeiro-${months}m.pdf`))

export const downloadLicensesContractsReport = () =>
  api.get('/reports/licenses-contracts/pdf', { responseType: 'blob' })
    .then(r => triggerDownload(r.data, 'relatorio-licencas-contratos.pdf'))

export const downloadInventoryReport = () =>
  api.get('/reports/inventory/pdf', { responseType: 'blob' })
    .then(r => triggerDownload(r.data, 'relatorio-inventario.pdf'))

export const downloadSecurityReport = (days) =>
  api.get('/reports/security/pdf', { params: { days }, responseType: 'blob' })
    .then(r => triggerDownload(r.data, `relatorio-seguranca-${days}d.pdf`))

export const downloadTeamReport = (days) =>
  api.get('/reports/team/pdf', { params: { days }, responseType: 'blob' })
    .then(r => triggerDownload(r.data, `relatorio-equipe-${days}d.pdf`))

export const downloadMonitoringReport = () =>
  api.get('/reports/monitoring/pdf', { responseType: 'blob' })
    .then(r => triggerDownload(r.data, 'relatorio-monitoramento.pdf'))

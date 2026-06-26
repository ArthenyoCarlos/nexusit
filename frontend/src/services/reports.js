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

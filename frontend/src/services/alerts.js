import api from './api'

export const getAlertsSummary = () => api.get('/alerts/summary').then(r => r.data)

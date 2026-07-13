import api from './api'

export const getAuditEvents = (params) => api.get('/audit', { params }).then(r => r.data)

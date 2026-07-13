import api from './api'

export const getUpdateStatus = () => api.get('/updates/status').then(r => r.data)
export const applyUpdate = () => api.post('/updates/apply').then(r => r.data)

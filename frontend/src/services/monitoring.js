import api from './api'

export const getHosts = () => api.get('/monitoring/hosts')
export const getProblems = () => api.get('/monitoring/problems')
export const getHistory = (hours = 24) => api.get(`/monitoring/history?hours=${hours}`)
export const getHostMetrics = (hostId, hours = 2) => api.get(`/monitoring/hosts/${hostId}/metrics`, { params: { hours } })
export const getUnifiApPanel = () => api.get('/monitoring/unifi-aps')

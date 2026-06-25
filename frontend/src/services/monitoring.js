import api from './api'

export const getHosts = () => api.get('/monitoring/hosts')
export const getProblems = () => api.get('/monitoring/problems')
export const getHistory = (hours = 24) => api.get(`/monitoring/history?hours=${hours}`)
export const getHostMetrics = (hostId) => api.get(`/monitoring/hosts/${hostId}/metrics`)

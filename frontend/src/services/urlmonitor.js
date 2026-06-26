import api from './api'

export const getMonitors  = ()         => api.get('/url-monitor').then(r => r.data)
export const createMonitor= (data)     => api.post('/url-monitor', data).then(r => r.data)
export const updateMonitor= (id, data) => api.put(`/url-monitor/${id}`, data).then(r => r.data)
export const deleteMonitor= (id)       => api.delete(`/url-monitor/${id}`)
export const checkNow     = (id)       => api.post(`/url-monitor/${id}/check`).then(r => r.data)

import api from './api'

export const getSshHosts   = ()       => api.get('/ssh-hosts').then(r => r.data)
export const getSshHost    = (id)     => api.get(`/ssh-hosts/${id}`).then(r => r.data)
export const createSshHost = (data)   => api.post('/ssh-hosts', data).then(r => r.data)
export const updateSshHost = (id, data) => api.put(`/ssh-hosts/${id}`, data).then(r => r.data)
export const deleteSshHost = (id)     => api.delete(`/ssh-hosts/${id}`)
export const resetHostKey  = (id)     => api.post(`/ssh-hosts/${id}/reset-host-key`).then(r => r.data)

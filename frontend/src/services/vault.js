import api from './api'

export const getCredentials  = (params) => api.get('/vault', { params }).then(r => r.data)
export const revealSecret    = (id)     => api.get(`/vault/${id}/reveal`).then(r => r.data.secret)
export const createCredential= (data)   => api.post('/vault', data).then(r => r.data)
export const updateCredential= (id, data) => api.put(`/vault/${id}`, data).then(r => r.data)
export const deleteCredential= (id)     => api.delete(`/vault/${id}`)

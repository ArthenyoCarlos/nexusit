import api from './api'

export const getSystems  = (params) => api.get('/systems', { params }).then(r => r.data)
export const getSystem   = (id)     => api.get(`/systems/${id}`).then(r => r.data)
export const createSystem = (data)  => api.post('/systems', data).then(r => r.data)
export const updateSystem = (id, data) => api.put(`/systems/${id}`, data).then(r => r.data)
export const deleteSystem = (id)    => api.delete(`/systems/${id}`)

import api from './api'

export const getLicenses  = ()         => api.get('/licenses').then(r => r.data)
export const createLicense= (data)     => api.post('/licenses', data).then(r => r.data)
export const updateLicense= (id, data) => api.put(`/licenses/${id}`, data).then(r => r.data)
export const deleteLicense= (id)       => api.delete(`/licenses/${id}`)

import api from './api'

export const getTemplates       = (params) => api.get('/onboarding/templates', { params }).then(r => r.data)
export const getActiveTemplates = (type)   => api.get('/onboarding/templates/active', { params: { type } }).then(r => r.data)
export const getTemplate        = (id)     => api.get(`/onboarding/templates/${id}`).then(r => r.data)
export const createTemplate     = (data)   => api.post('/onboarding/templates', data).then(r => r.data)
export const updateTemplate     = (id, data) => api.put(`/onboarding/templates/${id}`, data).then(r => r.data)
export const deleteTemplate     = (id)     => api.delete(`/onboarding/templates/${id}`)

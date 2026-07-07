import api from './api'

export const getChecklists   = (params)              => api.get('/onboarding', { params }).then(r => r.data)
export const getChecklist    = (id)                  => api.get(`/onboarding/${id}`).then(r => r.data)
export const createChecklist = (data)                => api.post('/onboarding', data).then(r => r.data)
export const updateChecklist = (id, data)            => api.put(`/onboarding/${id}`, data).then(r => r.data)
export const toggleItem      = (checklistId, itemId) => api.patch(`/onboarding/${checklistId}/items/${itemId}/toggle`).then(r => r.data)
export const addItem         = (checklistId, data)   => api.post(`/onboarding/${checklistId}/items`, data).then(r => r.data)
export const updateItem      = (checklistId, itemId, data) => api.patch(`/onboarding/${checklistId}/items/${itemId}`, data).then(r => r.data)
export const removeItem      = (checklistId, itemId) => api.delete(`/onboarding/${checklistId}/items/${itemId}`).then(r => r.data)
export const deleteChecklist = (id)                  => api.delete(`/onboarding/${id}`)

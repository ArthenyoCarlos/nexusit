import api from './api'

export const getChecklists  = (params)            => api.get('/onboarding', { params }).then(r => r.data)
export const getChecklist   = (id)                => api.get(`/onboarding/${id}`).then(r => r.data)
export const createChecklist= (data)              => api.post('/onboarding', data).then(r => r.data)
export const toggleItem     = (checklistId, itemId) => api.patch(`/onboarding/${checklistId}/items/${itemId}/toggle`).then(r => r.data)
export const deleteChecklist= (id)                => api.delete(`/onboarding/${id}`)

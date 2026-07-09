import api from './api'

export const getQueue              = ()       => api.get('/support/queue').then(r => r.data)
export const getMine               = ()       => api.get('/support/mine').then(r => r.data)
export const getConversation       = (id)     => api.get(`/support/${id}`).then(r => r.data)
export const getMessageMediaBlob   = (messageId) => api.get(`/support/messages/${messageId}/media`, { responseType: 'blob' }).then(r => r.data)
export const claimConversation     = (id)     => api.post(`/support/${id}/claim`).then(r => r.data)
export const replyToConversation   = (id, message, file) => {
  if (file) {
    const form = new FormData()
    if (message?.trim()) form.append('message', message.trim())
    form.append('file', file)
    return api.post(`/support/${id}/reply`, form).then(r => r.data)
  }
  return api.post(`/support/${id}/reply`, { message }).then(r => r.data)
}
export const closeConversation     = (id)     => api.post(`/support/${id}/close`).then(r => r.data)
export const addTechnician         = (id, userId) => api.post(`/support/${id}/technicians`, { userId }).then(r => r.data)
export const removeTechnician      = (id, technicianId) => api.delete(`/support/${id}/technicians/${technicianId}`).then(r => r.data)
export const transferConversation  = (id, userId) => api.post(`/support/${id}/transfer`, { userId }).then(r => r.data)
export const getAllConversations   = (days = 30) => api.get('/support/all', { params: { days } }).then(r => r.data)

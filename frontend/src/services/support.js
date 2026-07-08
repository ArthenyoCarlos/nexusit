import api from './api'

export const getQueue              = ()       => api.get('/support/queue').then(r => r.data)
export const getMine               = ()       => api.get('/support/mine').then(r => r.data)
export const getConversation       = (id)     => api.get(`/support/${id}`).then(r => r.data)
export const getMessageMediaBlob   = (messageId) => api.get(`/support/messages/${messageId}/media`, { responseType: 'blob' }).then(r => r.data)
export const claimConversation     = (id)     => api.post(`/support/${id}/claim`).then(r => r.data)
export const replyToConversation   = (id, message) => api.post(`/support/${id}/reply`, { message }).then(r => r.data)
export const closeConversation     = (id)     => api.post(`/support/${id}/close`).then(r => r.data)

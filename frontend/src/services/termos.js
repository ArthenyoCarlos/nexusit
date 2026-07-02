import api from './api'

export const getTermos = () => api.get('/termos').then(r => r.data)
export const getTermo = (id) => api.get(`/termos/${id}`).then(r => r.data)
export const createTermo = (payload) => api.post('/termos', payload).then(r => r.data)
export const updateTermo = (id, payload) => api.put(`/termos/${id}`, payload).then(r => r.data)
export const signTermo = (id, assinaturaDigital) => api.post(`/termos/${id}/assinar`, { assinaturaDigital }).then(r => r.data)
export const addOcorrencia = (id, payload) => api.post(`/termos/${id}/ocorrencias`, payload).then(r => r.data)
export const getTermoTemplate = () => api.get('/termos/template').then(r => r.data)
export const updateTermoTemplate = (payload) => api.put('/termos/template', payload).then(r => r.data)
export const termoPdfUrl = (id) => `/api/termos/${id}/pdf`

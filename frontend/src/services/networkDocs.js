import api from './api'

export const getDocs = (section) =>
  api.get('/network-docs', section ? { params: { section } } : undefined)

export const createDoc = (data) => api.post('/network-docs', data)
export const updateDoc = (id, data) => api.put(`/network-docs/${id}`, data)
export const deleteDoc = (id) => api.delete(`/network-docs/${id}`)

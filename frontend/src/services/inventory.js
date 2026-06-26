import api from './api'

export const getInventory     = (params) => api.get('/inventory', { params }).then(r => r.data)
export const getInventoryItem = (id)     => api.get(`/inventory/${id}`).then(r => r.data)
export const createItem       = (data)   => api.post('/inventory', data).then(r => r.data)
export const updateItem       = (id, data) => api.put(`/inventory/${id}`, data).then(r => r.data)
export const deleteItem       = (id)     => api.delete(`/inventory/${id}`)
export const getEtiqueta      = (id)     => api.get(`/inventory/${id}/etiqueta`, { responseType: 'blob' }).then(r => r.data)

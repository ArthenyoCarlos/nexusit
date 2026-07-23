import api from './api'

export const getInventory     = (params) => api.get('/inventory', { params }).then(r => r.data)
// Lista completa (não paginada) para telas que usam o inventário como fonte de dados
// auxiliar (dropdowns, dashboards, contagens) em vez de exibir a tabela paginada.
export const getAllInventory  = (params) => api.get('/inventory', { params: { ...params, size: 1000 } }).then(r => r.data.content)
export const getInventoryItem = (id)     => api.get(`/inventory/${id}`).then(r => r.data)
export const createItem       = (data)   => api.post('/inventory', data).then(r => r.data)
export const updateItem       = (id, data) => api.put(`/inventory/${id}`, data).then(r => r.data)
export const deleteItem       = (id)     => api.delete(`/inventory/${id}`)
export const getEtiqueta      = (id)     => api.get(`/inventory/${id}/etiqueta`, { responseType: 'blob' }).then(r => r.data)

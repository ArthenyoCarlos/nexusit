import api from './api'

export const getMaintenance  = (inventoryId)       => api.get(`/inventory/${inventoryId}/maintenance`).then(r => r.data)
export const createMaintenance=(inventoryId, data)  => api.post(`/inventory/${inventoryId}/maintenance`, data).then(r => r.data)
export const deleteMaintenance=(inventoryId, id)    => api.delete(`/inventory/${inventoryId}/maintenance/${id}`)

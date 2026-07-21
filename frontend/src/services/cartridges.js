import api from './api'

export const getCartridges       = (params) => api.get('/cartridges', { params }).then(r => r.data)
export const getCartridge        = (id)     => api.get(`/cartridges/${id}`).then(r => r.data)
export const getCartridgeByCode  = (code)   => api.get(`/cartridges/by-code/${encodeURIComponent(code)}`).then(r => r.data)
export const createCartridge     = (data)   => api.post('/cartridges', data).then(r => r.data)
export const startMaintenance    = (id, data) => api.post(`/cartridges/${id}/start-maintenance`, data).then(r => r.data)
export const finishMaintenance   = (id, data) => api.post(`/cartridges/${id}/finish-maintenance`, data).then(r => r.data)
export const discardCartridge    = (id, data) => api.post(`/cartridges/${id}/discard`, data).then(r => r.data)
export const getCartridgeEtiqueta = (id)    => api.get(`/cartridges/${id}/etiqueta`, { responseType: 'blob' }).then(r => r.data)

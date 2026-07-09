import api from './api'

export const getNexusDeskDevices  = ()       => api.get('/nexusdesk/devices').then(r => r.data)
export const createNexusDeskDevice = (data)  => api.post('/nexusdesk/devices', data).then(r => r.data)
export const updateNexusDeskDevice = (id, data) => api.put(`/nexusdesk/devices/${id}`, data).then(r => r.data)
export const deleteNexusDeskDevice = (id)    => api.delete(`/nexusdesk/devices/${id}`)
export const connectNexusDeskDevice = (id, ticketId) =>
  api.post(`/nexusdesk/devices/${id}/connect`, null, { params: ticketId ? { ticketId } : {} }).then(r => r.data)
export const getNexusDeskSessions = ()       => api.get('/nexusdesk/sessions').then(r => r.data)

import api from './api'

export const getBroadcastContacts = () => api.get('/broadcast/contacts').then(r => r.data)
export const getBroadcastGroups   = () => api.get('/broadcast/groups').then(r => r.data)
export const discoverGroups       = () => api.get('/broadcast/groups/discover').then(r => r.data)
export const saveGroup            = (name, groupJid) => api.post('/broadcast/groups', { name, groupJid }).then(r => r.data)
export const deleteGroup          = (id) => api.delete(`/broadcast/groups/${id}`).then(r => r.data)
export const sendBroadcast        = (targetType, targetId, message) =>
  api.post('/broadcast/send', { targetType, targetId, message }).then(r => r.data)
export const getBroadcastHistory  = (days = 30) => api.get('/broadcast/history', { params: { days } }).then(r => r.data)

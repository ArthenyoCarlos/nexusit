import api from './api'

export const getSchedules  = ()              => api.get('/maintenance-schedules').then(r => r.data)
export const createSchedule= (data)          => api.post('/maintenance-schedules', data).then(r => r.data)
export const completeSchedule = (id, notes)  => api.post(`/maintenance-schedules/${id}/complete`, { notes }).then(r => r.data)
export const deleteSchedule= (id)            => api.delete(`/maintenance-schedules/${id}`)

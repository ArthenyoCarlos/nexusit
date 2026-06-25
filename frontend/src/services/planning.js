import api from './api'

export const getTasks = () => api.get('/planning/tasks')
export const createTask = (data) => api.post('/planning/tasks', data)
export const updateTask = (id, data) => api.put(`/planning/tasks/${id}`, data)
export const moveTask = (id, data) => api.put(`/planning/tasks/${id}/move`, data)
export const deleteTask = (id) => api.delete(`/planning/tasks/${id}`)

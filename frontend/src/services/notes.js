import api from './api'

export const getNotes = () => api.get('/notes')
export const searchNotes = (params) => api.get('/notes/search', { params })
export const createNote = (data) => api.post('/notes', data)
export const updateNote = (id, data) => api.put(`/notes/${id}`, data)
export const deleteNote = (id) => api.delete(`/notes/${id}`)

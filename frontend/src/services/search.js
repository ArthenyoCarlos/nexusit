import api from './api'

export const globalSearch = (q) => api.get('/search', { params: { q } }).then(r => r.data)

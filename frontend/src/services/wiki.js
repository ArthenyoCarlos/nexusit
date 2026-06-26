import api from './api'

export const getArticles   = (category) => api.get('/wiki', { params: { category } }).then(r => r.data)
export const getArticle    = (id)        => api.get(`/wiki/${id}`).then(r => r.data)
export const searchWiki    = (q)         => api.get('/wiki/search', { params: { q } }).then(r => r.data)
export const createArticle = (data)      => api.post('/wiki', data).then(r => r.data)
export const updateArticle = (id, data)  => api.put(`/wiki/${id}`, data).then(r => r.data)
export const deleteArticle = (id)        => api.delete(`/wiki/${id}`)

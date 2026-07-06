import api from './api'

export const getHermesSummary = () => api.get('/hermes/summary').then(r => r.data)

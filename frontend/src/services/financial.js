import api from './api'

export const getFinancialSummary = ()         => api.get('/financial/summary').then(r => r.data)
export const getBills            = ()         => api.get('/financial/bills').then(r => r.data)
export const createBill          = (data)     => api.post('/financial/bills', data).then(r => r.data)
export const updateBill          = (id, data) => api.put(`/financial/bills/${id}`, data).then(r => r.data)
export const payBill             = (id)       => api.patch(`/financial/bills/${id}/pay`).then(r => r.data)
export const deleteBill          = (id)       => api.delete(`/financial/bills/${id}`)

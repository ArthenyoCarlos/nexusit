import api from './api'

export const getBackupSummary = () => api.get('/backups')
export const getBackupRuns = (jobId) => api.get(`/backups/${jobId}/runs`)
export const recordBackupRun = (jobId, payload) => api.post(`/backups/${jobId}/runs`, payload)

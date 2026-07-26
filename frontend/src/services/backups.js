import api from './api'

export const getBackupSummary = () => api.get('/backups')
export const getBackupRuns = (jobId) => api.get(`/backups/${jobId}/runs`)
export const getBackupRestoreTests = (jobId) => api.get(`/backups/${jobId}/restore-tests`)
export const getBackupRequests = (jobId) => api.get(`/backups/${jobId}/requests`)
export const recordBackupRun = (jobId, payload) => api.post(`/backups/${jobId}/runs`, payload)
export const recordBackupRestoreTest = (jobId, payload) => api.post(`/backups/${jobId}/restore-tests`, payload)
export const enqueueBackupNow = (jobId) => api.post(`/backups/${jobId}/backup-now`)
export const enqueueRestoreTestNow = (jobId) => api.post(`/backups/${jobId}/restore-test-now`)

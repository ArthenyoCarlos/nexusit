import api from './api'

export const getTicketAssetLinks = (glpiTicketId) =>
  api.get(`/ticket-asset-links/glpi/${glpiTicketId}`).then(r => r.data)

export const createTicketAssetLink = (data) =>
  api.post('/ticket-asset-links', data).then(r => r.data)

export const deleteTicketAssetLink = (id) =>
  api.delete(`/ticket-asset-links/${id}`)

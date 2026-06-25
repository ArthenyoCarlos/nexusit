import api from './api'

export const getTickets = (status) =>
  api.get('/glpi/tickets', { params: status != null ? { status } : {} })

export const getTicket = (id) =>
  api.get(`/glpi/tickets/${id}`)

export const addFollowup = (id, content) =>
  api.post(`/glpi/tickets/${id}/followup`, { content })

export const closeTicket = (id) =>
  api.put(`/glpi/tickets/${id}/close`)

export const assignTicket = (id, userId) =>
  api.put(`/glpi/tickets/${id}/assign`, { userId })

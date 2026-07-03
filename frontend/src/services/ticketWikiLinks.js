import api from './api'

export const getTicketWikiLinks = (glpiTicketId) =>
  api.get(`/ticket-wiki-links/glpi/${glpiTicketId}`).then(r => r.data)

export const createTicketWikiLink = (data) =>
  api.post('/ticket-wiki-links', data).then(r => r.data)

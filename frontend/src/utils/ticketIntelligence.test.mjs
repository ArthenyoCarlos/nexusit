import assert from 'node:assert/strict'
import { buildTicketSummary, buildSuggestedResolution, buildWikiArticleFromTicket } from './ticketIntelligence.js'

const detail = {
  ticket: {
    id: 25,
    title: 'Sistema lento',
    statusLabel: 'Resolvido',
    priorityLabel: 'Média',
    requester: 'Teresa',
    assignedTo: 'Arthenyo Carlos',
    openedAt: '2026-07-03 10:20:00',
    solvedAt: '2026-07-03 10:33:37',
  },
  content: 'O usuário Teresa me passou que o sistema estava lento',
  followups: [
    { author: 'Arthenyo Carlos', date: '2026-07-03 10:33:37', content: 'Foi refeito o cabo de rede e o sistema voltou ao normal.' }
  ]
}

const summary = buildTicketSummary(detail)
assert.match(summary, /Chamado #25 — Sistema lento/)
assert.match(summary, /Solicitante: Teresa/)
assert.match(summary, /Ação mais recente: Foi refeito o cabo de rede/)

const resolution = buildSuggestedResolution(detail)
assert.match(resolution, /Causa provável: instabilidade física ou lógica/)
assert.match(resolution, /Ação executada: Foi refeito o cabo de rede/)
assert.match(resolution, /Resultado: sistema voltou ao funcionamento normal/)

const article = buildWikiArticleFromTicket(detail, resolution)
assert.equal(article.title, 'Chamado #25: Sistema lento')
assert.equal(article.category, 'Procedimentos')
assert.match(article.tags, /glpi/)
assert.match(article.content, /# Chamado #25: Sistema lento/)
assert.match(article.content, /## Sintoma/)
assert.match(article.content, /## Resolução/) 
assert.match(article.content, /Foi refeito o cabo de rede/)

console.log('ticketIntelligence tests passed')

import assert from 'node:assert/strict'
import { buildTicketSummary, buildSuggestedResolution, buildWikiArticleFromTicket, buildWikiLinkFollowup, isPendingResolutionDraft, hasSpecificResolution, buildWikiSearchQueries, mergeWikiSuggestions, shouldWarnBeforeCreatingWikiArticle, detectDuplicateTicketGroups, findDuplicateTicketsFor } from './ticketIntelligence.js'

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

const zabbixAutoTicket = {
  ticket: {
    id: 22,
    title: '[Zabbix] Switch US-24 PoE 250W: Network Generic Device: Interface 0/5(Port 5): Link down por mais de 12h',
    statusLabel: 'Novo',
    priorityLabel: 'Média',
    requester: 'Zabbix',
    assignedTo: 'Arthenyo Carlos',
  },
  content: `Chamado aberto automaticamente por alerta ativo do Zabbix.

Host: Switch US-24 PoE 250W
Alerta: Network Generic Device: Interface 0/5(Port 5): Link down por mais de 12h
Severidade: Média
Event ID Zabbix: 794
Detectado em: 2026-07-03 09:46:03

ZABBIX_EVENT_ID: 794`,
  followups: []
}

const zabbixResolution = buildSuggestedResolution(zabbixAutoTicket)
assert.match(zabbixResolution, /Tipo: alerta automático do Zabbix/)
assert.match(zabbixResolution, /Host afetado: Switch US-24 PoE 250W/)
assert.match(zabbixResolution, /Alerta: Network Generic Device: Interface 0\/5\(Port 5\): Link down por mais de 12h/)
assert.match(zabbixResolution, /Resolução pendente: ainda não há ação técnica registrada/)
assert.match(zabbixResolution, /Próxima ação sugerida: verificar fisicamente/)
assert.doesNotMatch(zabbixResolution, /Ação executada: Chamado aberto automaticamente/)
assert.doesNotMatch(zabbixResolution, /Resultado: atendimento registrado/)
assert.equal(isPendingResolutionDraft(zabbixResolution), true)
assert.equal(isPendingResolutionDraft(resolution), false)

assert.equal(hasSpecificResolution(resolution), true)
assert.equal(hasSpecificResolution(zabbixResolution), false)
assert.equal(hasSpecificResolution(''), false)
assert.equal(hasSpecificResolution('Causa provável: instabilidade.\nAção executada: [TI Arthenyo Carlos] vlw ze!\nResultado: atendimento registrado.'), false)
assert.equal(hasSpecificResolution('[TI Arthenyo Carlos] Feito'), false)
assert.equal(hasSpecificResolution('Troquei o cabo de rede da estação 12 e o sistema normalizou.'), true)

const wikiFollowup = buildWikiLinkFollowup({ title: article.title, id: 'abc-123' }, 'https://nexus.local')
assert.match(wikiFollowup, /Documentação gerada automaticamente na Wiki do NexusIT/)
assert.match(wikiFollowup, /Chamado #25: Sistema lento/)
assert.match(wikiFollowup, /https:\/\/nexus.local\/wiki\/abc-123/)

const searchQueries = buildWikiSearchQueries(zabbixAutoTicket)
assert.deepEqual(searchQueries.slice(0, 4), [
  'Switch US-24 PoE 250W',
  'Interface 0/5(Port 5): Link down por mais de 12h',
  'Link down',
  'Switch US-24 PoE 250W Link down',
])
assert.equal(new Set(searchQueries).size, searchQueries.length)
assert.ok(searchQueries.length <= 6)

const merged = mergeWikiSuggestions([
  [{ id: '1', title: 'Link down porta switch', category: 'Rede', tags: 'switch,link-down,zabbix', updatedAt: '2026-07-03T10:00:00', linkedTicketCount: 3 }],
  [{ id: '1', title: 'Link down porta switch', category: 'Rede', tags: 'switch,link-down,zabbix', updatedAt: '2026-07-03T10:00:00', linkedTicketCount: 3 }, { id: '2', title: 'VPN caiu', category: 'Rede', tags: 'vpn', updatedAt: '2026-07-02T10:00:00' }],
  [{ id: '3', title: 'Nota fiscal indisponível', category: 'Sistemas', tags: 'sefaz,nfe', updatedAt: '2026-07-04T10:00:00' }],
], { detail: zabbixAutoTicket, queries: searchQueries })
assert.equal(merged.length, 3)
assert.equal(merged[0].matchCount, 2)
assert.equal(merged[0].id, '1')
assert.ok(merged[0].score > merged[1].score)
assert.ok(merged[0].scoreReasons.includes('Título'))
assert.ok(merged[0].scoreReasons.includes('Categoria'))
assert.ok(merged[0].scoreReasons.includes('Tags'))
assert.ok(merged[0].scoreReasons.includes('Termos'))
assert.ok(merged[0].scoreReasons.includes('Uso'))
assert.equal(shouldWarnBeforeCreatingWikiArticle(merged), true)
assert.equal(shouldWarnBeforeCreatingWikiArticle([]), false)
assert.equal(shouldWarnBeforeCreatingWikiArticle(null), false)

const duplicateTickets = [
  { id: 101, title: 'Acesso ao fornecedor', requester: 'Idalina', status: 1, openedAt: '2026-07-03T10:00:00' },
  { id: 102, title: 'Acesso ao fornecedor', requester: 'Idalina', status: 2, openedAt: '2026-07-03T10:02:00' },
  { id: 103, title: 'Acesso ao Fornecedor 6172', requester: 'Idalina', status: 1, openedAt: '2026-07-03T10:04:00' },
  { id: 104, title: 'Acesso ao fornecedor', requester: 'Maria', status: 1, openedAt: '2026-07-03T10:06:00' },
  { id: 105, title: 'Acesso ao fornecedor', requester: 'Idalina', status: 6, openedAt: '2026-07-03T09:00:00' },
]
const duplicateGroups = detectDuplicateTicketGroups(duplicateTickets)
assert.equal(duplicateGroups.length, 1)
assert.equal(duplicateGroups[0].count, 3)
assert.deepEqual(duplicateGroups[0].tickets.map(t => t.id).sort(), [101, 102, 103])
const duplicatesFor101 = findDuplicateTicketsFor(duplicateTickets[0], duplicateTickets)
assert.deepEqual(duplicatesFor101.map(t => t.id).sort(), [102, 103])
assert.deepEqual(findDuplicateTicketsFor(duplicateTickets[3], duplicateTickets), [])

console.log('ticketIntelligence tests passed')

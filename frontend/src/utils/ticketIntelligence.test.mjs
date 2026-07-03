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
assert.doesNotMatch(zabbixResolution, /Resultado: atendimento registrado e validado/)

console.log('ticketIntelligence tests passed')

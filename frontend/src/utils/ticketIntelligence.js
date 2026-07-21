function cleanHtml(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#62;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function lastUsefulFollowup(detail) {
  const followups = Array.isArray(detail?.followups) ? detail.followups : []
  return [...followups].reverse().find(f => cleanHtml(f?.content))
}

function categoryFromTicket(ticket = {}, content = '') {
  const text = `${ticket.title || ''} ${content}`.toLowerCase()
  if (/rede|cabo|wifi|vpn|internet|link|switch|porta/.test(text)) return 'Rede'
  if (/senha|acesso|permiss|login|usuário|usuario|rotina/.test(text)) return 'Acesso e Permissões'
  if (/backup|restore|restaura/.test(text)) return 'Backup'
  if (/impressora|notebook|computador|pc|monitor|teclado|mouse|scanner|coletor/.test(text)) return 'Hardware'
  if (/sistema|winthor|harpia|erp|sefaz|nota fiscal|nfe|nf-e|máxima|maxima/.test(text)) return 'Sistemas'
  return 'Procedimentos'
}

function resultFromText(text = '') {
  const value = cleanHtml(text).toLowerCase()
  if (/voltou ao normal|normalizado|funcionando|resolvido|corrigido|acesso liberado|liberado/.test(value)) {
    return 'sistema voltou ao funcionamento normal'
  }
  return 'atendimento registrado e validado conforme retorno operacional'
}

function fieldFromText(text = '', label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = cleanHtml(text).match(new RegExp(`^${escaped}:\\s*(.+)$`, 'im'))
  return match?.[1]?.trim() || ''
}

function isAutomaticZabbixTicket(ticket = {}, content = '') {
  const text = `${ticket.title || ''}\n${content}`.toLowerCase()
  return text.includes('zabbix') && (
    text.includes('chamado aberto automaticamente') ||
    text.includes('zabbix_event_id') ||
    text.includes('event id zabbix')
  )
}

function hasTechnicalAction(followupText = '') {
  const text = cleanHtml(followupText).toLowerCase()
  if (!text) return false
  return !/chamado aberto automaticamente|zabbix_event_id|event id zabbix/.test(text)
}

function zabbixNextAction(alert = '') {
  const value = alert.toLowerCase()
  if (/interface|link down|porta|port/.test(value)) {
    return 'verificar fisicamente o cabo/equipamento conectado à porta, confirmar se a porta deveria estar ativa e validar no Zabbix se o evento normalizou.'
  }
  if (/vpn|tunnel|tunel|túnel/.test(value)) {
    return 'validar conectividade entre as pontas da VPN, logs do firewall e estado do túnel antes de fechar o chamado.'
  }
  if (/serviço|service|processo/.test(value)) {
    return 'validar o serviço no host, revisar logs recentes e reiniciar somente se o procedimento permitir.'
  }
  if (/disco|space|filesystem|storage/.test(value)) {
    return 'verificar uso de disco, arquivos temporários/logs e crescimento anormal antes de liberar espaço.'
  }
  return 'validar o alerta no Zabbix, confirmar impacto real e registrar a ação técnica executada antes do fechamento.'
}

export function buildTicketSummary(detail) {
  const ticket = detail?.ticket || detail || {}
  const content = cleanHtml(detail?.content || '')
  const last = lastUsefulFollowup(detail)
  const lastText = cleanHtml(last?.content || '')
  const lines = [
    `Chamado #${ticket.id} — ${ticket.title || '(sem título)'}`,
    `Status: ${ticket.statusLabel || '—'} · Prioridade: ${ticket.priorityLabel || '—'}`,
    `Solicitante: ${ticket.requester || '—'}`,
    `Responsável: ${ticket.assignedTo || '—'}`,
  ]
  if (content) lines.push(`Descrição: ${content}`)
  if (lastText) lines.push(`Ação mais recente: ${lastText}`)
  return lines.join('\n')
}

export function buildSuggestedResolution(detail) {
  const ticket = detail?.ticket || detail || {}
  const content = cleanHtml(detail?.content || '')
  const last = lastUsefulFollowup(detail)
  const lastText = cleanHtml(last?.content || '')
  const category = categoryFromTicket(ticket, `${content} ${lastText}`)

  if (isAutomaticZabbixTicket(ticket, content) && !hasTechnicalAction(lastText)) {
    const host = fieldFromText(content, 'Host') || 'não identificado'
    const alert = fieldFromText(content, 'Alerta') || ticket.title || 'alerta Zabbix não identificado'
    const severity = fieldFromText(content, 'Severidade') || ticket.priorityLabel || '—'
    const eventId = fieldFromText(content, 'Event ID Zabbix') || fieldFromText(content, 'ZABBIX_EVENT_ID') || '—'
    return [
      'Tipo: alerta automático do Zabbix.',
      `Host afetado: ${host}`,
      `Alerta: ${alert}`,
      `Severidade: ${severity}`,
      `Event ID Zabbix: ${eventId}`,
      'Resolução pendente: ainda não há ação técnica registrada neste chamado.',
      `Próxima ação sugerida: ${zabbixNextAction(alert)}`,
      'Observação: não fechar como resolvido até registrar a ação executada e confirmar normalização ou justificativa operacional.',
    ].join('\n')
  }

  const causeByCategory = {
    Rede: 'instabilidade física ou lógica na conexão de rede',
    'Acesso e Permissões': 'necessidade de ajuste de permissão/acesso do usuário',
    Backup: 'necessidade de correção ou validação do processo de backup/restauração',
    Hardware: 'falha ou necessidade de ajuste em equipamento físico',
    Sistemas: 'instabilidade ou inconsistência no sistema utilizado',
    Procedimentos: 'solicitação operacional tratada conforme procedimento de TI',
  }
  const action = hasTechnicalAction(lastText) ? lastText : (content || 'Ação técnica executada conforme análise do chamado.')
  return [
    `Causa provável: ${causeByCategory[category]}.`,
    `Ação executada: ${action}`,
    `Resultado: ${resultFromText(action)}.`,
    'Recomendação: monitorar reincidência e registrar novo acompanhamento caso o problema volte a ocorrer.',
  ].join('\n')
}

export function isPendingResolutionDraft(text = '') {
  return /Resolução pendente:/i.test(cleanHtml(text))
}

const CASUAL_REPLY_RE = /^(vlw|valeu|blz|beleza|ok(ay)?|certo|show|de nada|feito|resolvido|pronto|obrigad[oa]s?|obg|tranquilo|falou|👍|✅)[\s!.,]*$/i

function stripAuthorPrefix(text = '') {
  return text.replace(/^\[[^\]]{1,80}\]\s*/, '').trim()
}

// Verifica se existe de fato uma ação técnica específica descrita (seja no texto
// já formatado pelo template — extraindo a linha "Ação executada:" — seja num
// texto livre digitado pelo técnico). Respostas curtas/casuais como "vlw" ou o
// aviso de chamado Zabbix ainda sem ação não contam como resolução específica.
export function hasSpecificResolution(resolutionText = '') {
  const text = cleanHtml(resolutionText)
  if (!text) return false
  if (isPendingResolutionDraft(text)) return false
  const actionField = fieldFromText(text, 'Ação executada')
  const candidate = stripAuthorPrefix(actionField || text)
  if (!candidate) return false
  if (CASUAL_REPLY_RE.test(candidate)) return false
  if (candidate.length < 15) return false
  return true
}

export function buildWikiLinkFollowup(article, origin = '') {
  const title = article?.title || 'Artigo da Wiki'
  const id = article?.id || ''
  const base = String(origin || '').replace(/\/$/, '')
  const url = id ? `${base}/wiki/${id}` : base
  return [
    'Documentação gerada automaticamente na Wiki do NexusIT.',
    '',
    `Artigo: ${title}`,
    `Link: ${url}`,
  ].join('\n')
}

export function buildWikiSearchQueries(detail) {
  const ticket = detail?.ticket || detail || {}
  const content = cleanHtml(detail?.content || '')
  const title = cleanHtml(ticket.title || '')
  const host = fieldFromText(content, 'Host')
  const alert = fieldFromText(content, 'Alerta').replace(/^Network Generic Device:\s*/i, '')
  const queries = []

  if (host) queries.push(host)
  if (alert) queries.push(alert)
  if (/link down/i.test(`${title} ${content}`)) queries.push('Link down')
  if (host && /link down/i.test(`${title} ${content}`)) queries.push(`${host} Link down`)

  const cleanedTitle = title
    .replace(/^\[?zabbix\]?\s*/i, '')
    .replace(/\bpor mais de \d+h\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleanedTitle) queries.push(cleanedTitle)

  const requester = cleanHtml(ticket.requester || '')
  if (requester && !/zabbix|sistema/i.test(requester)) queries.push(requester)

  return [...new Set(queries.map(q => q.trim()).filter(q => q.length >= 3))].slice(0, 6)
}

function normalizeText(value = '') {
  return cleanHtml(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreWikiSuggestion(article, { detail = null, queries = [] } = {}) {
  const ticket = detail?.ticket || detail || {}
  const ticketText = normalizeText(`${ticket.title || ''} ${detail?.content || ''}`)
  const inferredCategory = categoryFromTicket(ticket, detail?.content || '')
  const haystack = normalizeText(`${article.title || ''} ${article.category || ''} ${article.tags || ''} ${article.content || ''}`)
  const title = normalizeText(article.title || '')
  const tags = normalizeText(article.tags || '')
  const category = normalizeText(article.category || '')
  const queryTokens = queries
    .flatMap(q => normalizeText(q).split(' '))
    .filter(t => t.length >= 4)
  const uniqueTokens = [...new Set(queryTokens)]
  const tokenHits = uniqueTokens.filter(token => haystack.includes(token)).length
  const usageCount = Number(article.linkedTicketCount ?? article.ticketLinkCount ?? article.usageCount ?? 0)
  const updatedAt = article.updatedAt || article.createdAt
  const ageDays = updatedAt ? Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86400000) : null
  const reasons = []
  let score = 0

  score += (article.matchCount || 1) * 12
  if (tokenHits > 0) {
    score += tokenHits * 4
    reasons.push('Termos')
  }
  if (title && uniqueTokens.some(token => title.includes(token))) {
    score += 10
    reasons.push('Título')
  }
  if (category && normalizeText(inferredCategory) === category) {
    score += 8
    reasons.push('Categoria')
  }
  if (tags && uniqueTokens.some(token => tags.includes(token))) {
    score += 6
    reasons.push('Tags')
  }
  if (usageCount > 0) {
    score += Math.min(usageCount, 5) * 3
    reasons.push('Uso')
  }
  if (ageDays != null && ageDays <= 30) {
    score += 4
    reasons.push('Recente')
  }
  if (ticketText && title && ticketText.includes(title)) {
    score += 12
    if (!reasons.includes('Título')) reasons.push('Título')
  }

  return { score, reasons: [...new Set(reasons)] }
}

export function mergeWikiSuggestions(resultGroups = [], context = {}) {
  const byId = new Map()
  resultGroups.flat().filter(Boolean).forEach(article => {
    const id = article.id
    if (!id) return
    const current = byId.get(id)
    if (current) {
      current.matchCount += 1
      current.searchHits = [...(current.searchHits || []), article]
      return
    }
    byId.set(id, { ...article, matchCount: 1, searchHits: [article] })
  })
  return [...byId.values()].map(article => {
    const { score, reasons } = scoreWikiSuggestion(article, context)
    return { ...article, score, scoreReasons: reasons }
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount
    return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
  }).slice(0, 6)
}

export function shouldWarnBeforeCreatingWikiArticle(suggestions = []) {
  return Array.isArray(suggestions) && suggestions.length > 0
}

function duplicateTicketSignature(ticket = {}) {
  const title = normalizeText(ticket.title || ticket.name || '')
    .split(' ')
    .filter(token => token.length >= 3 && !/^\d+$/.test(token) && !['para', 'com', 'dos', 'das', 'uma', 'sem', 'por', 'mais'].includes(token))
    .join(' ')
  const requester = normalizeText(ticket.requester || ticket.requesterName || '')
  if (!title || !requester) return ''
  return `${requester}|${title}`
}

function isOpenDuplicateCandidate(ticket = {}) {
  const status = Number(ticket.status)
  return ![5, 6].includes(status)
}

export function detectDuplicateTicketGroups(tickets = []) {
  const groups = new Map()
  ;(tickets || []).filter(isOpenDuplicateCandidate).forEach(ticket => {
    const key = duplicateTicketSignature(ticket)
    if (!key) return
    const list = groups.get(key) || []
    list.push(ticket)
    groups.set(key, list)
  })
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      tickets: [...items].sort((a, b) => String(b.openedAt || '').localeCompare(String(a.openedAt || ''))),
    }))
    .sort((a, b) => b.count - a.count)
}

export function findDuplicateTicketsFor(ticket, tickets = []) {
  if (!ticket || !isOpenDuplicateCandidate(ticket)) return []
  const key = duplicateTicketSignature(ticket)
  if (!key) return []
  const group = detectDuplicateTicketGroups(tickets).find(item => item.key === key)
  return group ? group.tickets.filter(item => item.id !== ticket.id) : []
}

export function buildWikiArticleFromTicket(detail, resolutionText = '') {
  const ticket = detail?.ticket || detail || {}
  const content = cleanHtml(detail?.content || '')
  const resolution = cleanHtml(resolutionText || buildSuggestedResolution(detail))
  const category = 'Procedimentos'
  const title = `Chamado #${ticket.id}: ${ticket.title || '(sem título)'}`
  const body = [
    `# ${title}`,
    '',
    '## Contexto',
    '',
    `- Chamado GLPI: #${ticket.id}`,
    `- Solicitante: ${ticket.requester || '—'}`,
    `- Responsável: ${ticket.assignedTo || '—'}`,
    `- Prioridade: ${ticket.priorityLabel || '—'}`,
    `- Status: ${ticket.statusLabel || '—'}`,
    '',
    '## Sintoma',
    '',
    content || ticket.title || 'Sintoma não informado no chamado.',
    '',
    '## Resolução',
    '',
    resolution,
    '',
    '## Validação',
    '',
    '- Confirmar com o solicitante que o serviço voltou ao normal.',
    '- Monitorar reincidência relacionada ao mesmo usuário, ativo ou sistema.',
    '',
    '## Prevenção',
    '',
    '- Registrar evidências quando houver alteração física, lógica ou de permissão.',
    '- Relacionar este artigo a chamados futuros semelhantes.',
  ].join('\n')

  return {
    title,
    category,
    tags: `glpi,chamado,hermes,${categoryFromTicket(ticket, `${content} ${resolution}`).toLowerCase().replaceAll(' ', '-')}`,
    content: body,
  }
}

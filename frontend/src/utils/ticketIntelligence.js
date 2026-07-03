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

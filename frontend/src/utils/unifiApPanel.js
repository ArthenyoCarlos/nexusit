export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—'
  const value = Math.max(0, Number(seconds))
  const days = Math.floor(value / 86400)
  const hours = Math.floor((value % 86400) / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatMs(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(1)} ms`
}

export function classifyAp(ap = {}) {
  if (ap.alertState === 'problem' || ap.lastLossPct >= 100) return 'down'
  if ((ap.lastLossPct ?? 0) > 0 || (ap.avgRttMs ?? 0) > 50 || (ap.reboots24h ?? 0) > 0 || ap.snmpOk === false) return 'warning'
  return 'healthy'
}

export function statusLabel(status) {
  return {
    healthy: 'Saudável',
    warning: 'Atenção',
    down: 'Crítico',
  }[status] ?? 'Desconhecido'
}

export function buildApSummary(aps = []) {
  const summary = { total: aps.length, healthy: 0, warning: 0, down: 0, avgLoss: 0, maxLatency: 0, reboots24h: 0, controllerEvents24h: 0, unmapped: 0 }
  if (aps.length === 0) return summary
  let lossSum = 0
  for (const ap of aps) {
    const status = classifyAp(ap)
    summary[status] += 1
    lossSum += Number(ap.avgLossPct ?? ap.lastLossPct ?? 0)
    summary.maxLatency = Math.max(summary.maxLatency, Number(ap.maxRttMs ?? ap.avgRttMs ?? 0))
    summary.reboots24h += Number(ap.reboots24h ?? 0)
    summary.controllerEvents24h += Number(ap.controllerEvents24h ?? 0)
    if (!ap.switchPort || ap.switchPort === 'unknown') summary.unmapped += 1
  }
  summary.avgLoss = lossSum / aps.length
  return summary
}

export function enrichAps(aps = []) {
  return aps
    .map(ap => ({ ...ap, status: classifyAp(ap) }))
    .sort((a, b) => {
      const rank = { down: 0, warning: 1, healthy: 2 }
      return rank[a.status] - rank[b.status] || String(a.name).localeCompare(String(b.name), 'pt-BR')
    })
}

export function explainApLast24h(ap = {}) {
  const samples = Number(ap.samples24h ?? 0)
  const down = Number(ap.downSamples24h ?? 0)
  const partial = Number(ap.lossSamples24h ?? 0)
  const reboots = Number(ap.reboots24h ?? 0)
  const events = Number(ap.controllerEvents24h ?? 0)
  const hasNetworkProblem = down > 0 || partial > 0
  const hasReboot = reboots > 0
  const hasEvents = events > 0

  let title = 'Últimas 24h sem problema de rede'
  let tone = 'healthy'
  let summary = 'O AP respondeu normalmente nos testes das últimas 24 horas.'

  if (down > 0) {
    title = 'Teve queda nas últimas 24h'
    tone = 'down'
    summary = `Em ${down} teste(s), o AP não respondeu. Pode ter ficado sem rede, energia/PoE ou cabo.`
  } else if (partial > 0) {
    title = 'Teve instabilidade nas últimas 24h'
    tone = 'warning'
    summary = `Em ${partial} teste(s), o AP respondeu com perda parcial. Pode indicar Wi‑Fi/rede instável.`
  } else if (hasReboot) {
    title = 'AP reiniciou nas últimas 24h'
    tone = 'warning'
    summary = `A rede respondeu aos testes, mas o AP reiniciou ${reboots} vez(es). Se não foi atualização/manutenção, vale verificar energia PoE, cabo e porta do switch.`
  } else if (hasEvents) {
    title = 'Só houve registros da controladora'
    tone = 'healthy'
    summary = `A controladora registrou ${events} evento(s), como login, cliente conectando ou troca de estado. Isso não significa problema sozinho.`
  }

  const details = [
    {
      label: 'Amostras',
      value: String(samples),
      explanation: 'Quantidade de testes feitos pelo monitoramento nas últimas 24h. Com coleta a cada minuto, esse número cresce ao longo do dia.',
      ok: samples > 0,
    },
    {
      label: 'Down',
      value: String(down),
      explanation: 'Quantas vezes o AP não respondeu ao teste de rede. Zero é bom. Maior que zero indica possível queda real no período.',
      ok: down === 0,
    },
    {
      label: 'Perda parcial',
      value: String(partial),
      explanation: 'Quantas vezes o AP respondeu, mas perdeu parte dos pacotes. Zero é bom. Maior que zero indica instabilidade.',
      ok: partial === 0,
    },
    {
      label: 'Reboot',
      value: String(reboots),
      explanation: 'Quantas vezes o AP parece ter reiniciado. Pode ser normal em atualização, mas se for inesperado verificar PoE, cabo, porta do switch e energia.',
      ok: reboots === 0,
    },
    {
      label: 'Eventos',
      value: String(events),
      explanation: 'Quantidade de registros da controladora UniFi relacionados ao AP. Pode incluir cliente conectando, login, provisionamento ou aviso. Clique nos eventos abaixo para entender cada um.',
      ok: true,
    },
  ]

  const action = hasNetworkProblem
    ? 'Verificar primeiro switch/porta, cabo e PoE do AP. Depois comparar com os eventos da controladora no mesmo horário.'
    : hasReboot
      ? 'Se o reboot não foi planejado, verificar PoE/energia, cabo, porta do switch e se houve atualização/provisionamento no UniFi.'
      : hasEvents
        ? 'Abrir os eventos listados abaixo. Se forem login ou cliente conectando, é apenas informativo.'
        : 'Nenhuma ação necessária agora.'

  return { title, summary, tone, details, action }
}

function matchValue(text, regex) {
  const match = String(text ?? '').match(regex)
  return match ? match[1] : null
}

export function explainUnifiEvent(event = {}) {
  const raw = String(event.message ?? '')
  const lower = raw.toLowerCase()
  const base = {
    severity: 'info',
    tone: 'healthy',
    title: 'Evento da controladora UniFi',
    summary: raw || 'Evento sem descrição',
    meaning: 'A controladora registrou uma atividade na rede UniFi.',
    whenProblem: 'Normalmente é apenas informativo. Verifique se começou a repetir muitas vezes ou junto com quedas de Wi-Fi.',
    action: 'Acompanhar no painel. Se houver reclamação dos usuários, verificar AP, switch/porta e clientes afetados.',
    raw,
  }

  const admin = matchValue(raw, /Admin\[([^\]]+)\]/i)
  if (/log in from/i.test(raw)) {
    const ip = matchValue(raw, /from\s+([0-9.]+)/i)
    return {
      ...base,
      title: 'Login na controladora',
      summary: `Usuário ${admin || 'administrador'} entrou na controladora${ip ? ` pelo IP ${ip}` : ''}.`,
      meaning: 'Alguém acessou o painel administrativo do UniFi Network.',
      whenProblem: 'Só é problema se esse acesso não foi feito por alguém autorizado ou ocorreu em horário estranho.',
      action: 'Se não reconhecer o acesso, trocar a senha da controladora e revisar usuários administrativos.',
    }
  }

  if (/\broams?\s+from\s+AP/i.test(raw)) {
    const client = matchValue(raw, /User\[([^\]]+)\]/i)
    const aps = [...String(raw).matchAll(/AP\[([^\]]+)\]/gi)].map(match => match[1])
    const channels = [...String(raw).matchAll(/channel\s+([^\s)]+(?:\([^)]*\))?)/gi)].map(match => match[1])
    const ssid = matchValue(raw, /on\s+"([^"]+)"\s*$/i) || matchValue(raw, /SSID\s+"([^"]+)"/i)
    const fromAp = event.fromApName || aps[0] || 'AP de origem'
    const toAp = event.toApName || aps[1] || event.apName || 'AP de destino'
    return {
      ...base,
      title: 'Cliente trocou de AP',
      summary: `Um dispositivo mudou do AP ${fromAp} para o AP ${toAp}${ssid ? ` na rede ${ssid}` : ''}.`,
      meaning: 'Isso é roaming: o equipamento estava conectado em um AP e passou para outro AP para tentar manter melhor sinal.',
      whenProblem: 'Normalmente é informativo. Vira problema se o mesmo cliente fica trocando de AP muitas vezes, perde conexão, ou se vários clientes fazem isso no mesmo local.',
      action: 'Se houver reclamação, verificar sinal entre os dois APs, potência/canais, interferência e se o cliente está no limite de cobertura.',
      details: [
        `Cliente: ${client || 'não identificado'}`,
        `AP origem: ${fromAp}`,
        `AP destino: ${toAp}`,
        ssid ? `Rede: ${ssid}` : null,
        channels[0] ? `Canal origem: ${channels[0]}` : null,
        channels[1] ? `Canal destino: ${channels[1]}` : null,
      ].filter(Boolean),
    }
  }

  if (/has connected to AP/i.test(raw)) {
    const client = matchValue(raw, /User\[([^\]]+)\]/i)
    const ap = matchValue(raw, /AP\[([^\]]+)\]/i)
    const ssid = matchValue(raw, /SSID\s+"([^"]+)"/i)
    const channel = matchValue(raw, /channel\s+([^\s)]+(?:\([^)]*\))?)/i)
    return {
      ...base,
      title: 'Cliente entrou no Wi‑Fi',
      summary: `Um dispositivo conectou no Wi‑Fi${ssid ? ` ${ssid}` : ''}${event.apName ? ` pelo AP ${event.apName}` : ''}.`,
      meaning: 'É um evento normal: um celular, coletor, notebook ou outro equipamento entrou na rede Wi‑Fi.',
      whenProblem: 'Vira problema se o mesmo cliente fica conectando/desconectando várias vezes ou se vários clientes caem no mesmo AP.',
      action: 'Se houver reclamação, conferir sinal do cliente, distância do AP, interferência e estabilidade do AP/switch.',
      details: [`Cliente: ${client || 'não identificado'}`, `AP/MAC: ${ap || event.apName || 'não identificado'}`, ssid ? `Rede: ${ssid}` : null, channel ? `Canal: ${channel}` : null].filter(Boolean),
    }
  }

  if (/has disconnected from AP|disconnected from AP|is disconnected|disconnect/i.test(raw)) {
    const client = matchValue(raw, /User\[([^\]]+)\]/i)
    return {
      ...base,
      severity: 'warning',
      tone: 'warning',
      title: 'Cliente saiu do Wi‑Fi',
      summary: `Um dispositivo desconectou do Wi‑Fi${event.apName ? ` no AP ${event.apName}` : ''}.`,
      meaning: 'Pode ser normal quando o usuário sai da área, desliga o aparelho ou troca de AP.',
      whenProblem: 'É problema se muitos clientes desconectam juntos, se acontece repetidamente no mesmo AP ou junto com perda/latência.',
      action: 'Verificar sinal, interferência, cabo/PoE do AP e eventos próximos no mesmo horário.',
      details: [`Cliente: ${client || 'não identificado'}`],
    }
  }

  if (/restarted|reboot|was restarted/i.test(lower)) {
    return {
      ...base,
      severity: 'problem',
      tone: 'down',
      title: 'AP reiniciou',
      summary: `${event.apName || 'Um AP'} reiniciou ou ficou indisponível por alguns instantes.`,
      meaning: 'Quando o AP reinicia, todos os clientes conectados nele caem temporariamente.',
      whenProblem: 'É problema real se não foi atualização planejada ou se acontece mais de uma vez no dia.',
      action: 'Conferir PoE/energia, cabo, porta do switch, temperatura e se houve atualização/provisionamento no UniFi.',
    }
  }

  if (/heartbeat|missed|lost contact|was disconnected|uplink.*lost|lost uplink/i.test(lower)) {
    return {
      ...base,
      severity: 'problem',
      tone: 'down',
      title: 'AP perdeu comunicação',
      summary: `${event.apName || 'Um AP'} perdeu comunicação com a controladora ou com o uplink.`,
      meaning: 'O AP pode ter ficado sem rede, sem energia PoE, com cabo ruim ou porta do switch instável.',
      whenProblem: 'Tratar como problema real se coincidir com queda de Wi‑Fi ou perda de pacote no painel.',
      action: 'Verificar cabo, PoE, porta do switch, energia local e histórico de perda/latência do AP.',
    }
  }

  if (/provision|adopt|upgrade|upgrad|firmware/i.test(lower)) {
    return {
      ...base,
      severity: 'warning',
      tone: 'warning',
      title: 'Alteração/provisionamento UniFi',
      summary: 'A controladora aplicou ou tentou aplicar configuração/atualização em equipamento UniFi.',
      meaning: 'Pode ser normal após mudança de configuração ou atualização.',
      whenProblem: 'É problema se fica repetindo, falha várias vezes ou acontece junto com queda do AP.',
      action: 'Verificar se houve alteração planejada. Se repetir, abrir o equipamento no UniFi e revisar status de adoção/provisionamento.',
    }
  }

  return base
}

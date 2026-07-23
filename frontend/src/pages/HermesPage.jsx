import { useState, useRef, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { getHermesSummary } from '../services/hermes'
import { getTickets } from '../services/glpi'
import { getProblems, getHosts } from '../services/monitoring'
import { getLicenses } from '../services/licenses'
import { getContracts } from '../services/contracts'
import { getAllInventory } from '../services/inventory'
import { getMonitors } from '../services/urlmonitor'

// ─────────────────────────────────────────────────────────
// INTENT DETECTION
// ─────────────────────────────────────────────────────────
function detectIntent(text) {
  const m = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/resumo|status geral|operacao|geral|visao|tudo/.test(m)) return 'summary'
  if (/chamado.*(crit|urgent|alt)|crit.*chamado|alta.*prior/.test(m)) return 'critical-tickets'
  if (/chamado.*(sem tecnico|sem atribuic|sem responsavel)|nao atribuido/.test(m)) return 'unassigned-tickets'
  if (/sla|prazo.*chamado|chamado.*prazo|tempo.*atendiment/.test(m)) return 'sla-tickets'
  if (/licenca.*(venc|expir)|venc.*licenca/.test(m)) return 'expiring-licenses'
  if (/contrato.*(venc|expir)|venc.*contrato/.test(m)) return 'expiring-contracts'
  if (/host.*(problem|alerta|falha)|alerta.*(zabbix|host)|problema.*(host|rede)/.test(m)) return 'zabbix-problems'
  if (/url.*(falha|fora|down)|site.*(fora|falha|erro)|monitor.*(url|site)/.test(m)) return 'urls-down'
  if (/inventario.*(manutencao|problema)|ativo.*(manutencao|problema)/.test(m)) return 'inventory-maintenance'
  if (/inventario.*(sem tombamento|sem serial)|sem tombamento/.test(m)) return 'inventory-incomplete'
  if (/onboarding|offboarding|integracao.*colaborador/.test(m)) return 'onboarding'
  if (/chamado|ticket|glpi/.test(m)) return 'tickets'
  if (/licenca/.test(m)) return 'licenses'
  if (/contrato/.test(m)) return 'contracts'
  if (/host|zabbix|monitoramento/.test(m)) return 'hosts'
  if (/inventario|ativo|equipamento/.test(m)) return 'inventory'
  if (/ajuda|o que voce|comandos|o que faz|posso perguntar/.test(m)) return 'help'
  return 'unknown'
}

// ─────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────
function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}

function fmtDays(days) {
  if (days < 0) return `venceu há ${Math.abs(days)} dias`
  if (days === 0) return 'vence hoje'
  return `${days} dia(s)`
}

const PRIORITY_LABEL = { 6: 'Crítica', 5: 'Muito Alta', 4: 'Alta', 3: 'Média', 2: 'Baixa', 1: 'Muito Baixa' }
const SEV_LABEL      = { 5: 'Disaster', 4: 'High', 3: 'Average', 2: 'Warning', 1: 'Info' }

// ─────────────────────────────────────────────────────────
// RESPONSE BUILDERS
// ─────────────────────────────────────────────────────────
async function buildSummaryResponse() {
  const [summary, ticketsR, problemsR, hostsR] = await Promise.allSettled([
    getHermesSummary(),
    getTickets(null),
    getProblems(),
    getHosts(),
  ])

  const s        = summary.status === 'fulfilled' ? summary.value : null
  const tickets  = ticketsR.status === 'fulfilled' ? ticketsR.value.data : []
  const problems = problemsR.status === 'fulfilled' ? problemsR.value.data : []
  const hosts    = hostsR.status === 'fulfilled' ? hostsR.value.data : []

  const openTickets  = tickets.filter(t => ![5, 6].includes(Number(t.status)))
  const critTickets  = openTickets.filter(t => Number(t.priority) >= 4)
  const noTechTickets= openTickets.filter(t => !t.assignedTo)
  const hostsOnline  = hosts.filter(h => h.available).length
  const critProblems = problems.filter(p => Number(p.severity) >= 4)

  // Final health score (base + Zabbix/GLPI adjustments)
  let score = s?.scoreBase ?? 100
  score -= Math.min(critProblems.length * 10, 30)
  score -= Math.min(problems.length * 3, 15)
  score -= Math.min(critTickets.length * 5, 15)
  score -= Math.min(openTickets.length * 1, 10)
  score  = Math.max(0, Math.min(score, 100))

  const scoreIcon = score >= 80 ? '🟢' : score >= 60 ? '🟡' : score >= 40 ? '🟠' : '🔴'

  const lines = [
    `${scoreIcon} SAÚDE DA TI: ${score}/100`,
    '',
  ]

  if (problems.length > 0) {
    lines.push(`🔴 ALERTAS ZABBIX: ${problems.length} ativo(s), ${critProblems.length} crítico(s)`)
    critProblems.slice(0, 3).forEach(p =>
      lines.push(`  • [${SEV_LABEL[p.severity] ?? p.severity}] ${p.hostName ?? p.hosts?.[0]?.host ?? '—'}: ${p.name}`)
    )
    if (critProblems.length > 3) lines.push(`  • ... e mais ${critProblems.length - 3} crítico(s)`)
  } else {
    lines.push('✅ ALERTAS ZABBIX: Nenhum problema ativo')
  }
  lines.push(`   Hosts: ${hostsOnline}/${hosts.length} online`)
  lines.push('')

  if (openTickets.length > 0) {
    lines.push(`🟡 CHAMADOS GLPI: ${openTickets.length} aberto(s) — ${critTickets.length} crítico(s), ${noTechTickets.length} sem técnico`)
    critTickets.slice(0, 3).forEach(t =>
      lines.push(`  • #${t.id} — ${t.title || '(sem título)'} [${PRIORITY_LABEL[t.priority] ?? t.priority}]`)
    )
    if (critTickets.length > 3) lines.push(`  • ... e mais ${critTickets.length - 3} crítico(s)`)
  } else {
    lines.push('✅ CHAMADOS GLPI: Nenhum chamado aberto')
  }
  lines.push('')

  if (s) {
    const totalExpLic = s.expiredLicenses + s.expiring30Licenses
    if (totalExpLic > 0) {
      lines.push(`🔴 LICENÇAS: ${s.expiredLicenses} vencida(s), ${s.expiring30Licenses} vencem em 30 dias`)
    } else if (s.expiring90Licenses > 0) {
      lines.push(`🟡 LICENÇAS: ${s.expiring90Licenses} vencem em até 90 dias`)
    } else {
      lines.push('✅ LICENÇAS: Todas em dia')
    }

    const totalExpCtrs = s.expiredContracts + s.expiring30Contracts
    if (totalExpCtrs > 0) {
      lines.push(`🔴 CONTRATOS: ${s.expiredContracts} vencido(s), ${s.expiring30Contracts} vencem em 30 dias`)
    } else if (s.expiring90Contracts > 0) {
      lines.push(`🟡 CONTRATOS: ${s.expiring90Contracts} vencem em até 90 dias`)
    } else {
      lines.push('✅ CONTRATOS: Todos em dia')
    }

    if (s.urlsDown > 0) {
      lines.push(`🔴 URLS: ${s.urlsDown} URL(s) com falha de ${s.urlsTotal} monitoradas`)
    } else {
      lines.push(`✅ URLS: ${s.urlsTotal} monitoradas, todas operacionais`)
    }

    lines.push(`📦 INVENTÁRIO: ${s.inventoryTotal} ativos — ${s.inventoryActive} ativos, ${s.inventoryMaintenance} em manutenção`)
  }

  // Attention items
  if (s?.attentionItems?.length > 0) {
    lines.push('')
    lines.push('⚠️ PONTOS DE ATENÇÃO:')
    s.attentionItems.filter(i => i.severity === 'critical' || i.severity === 'warning').forEach(item =>
      lines.push(`  • ${item.message}`)
    )
  }

  lines.push('')
  lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)
  return lines.join('\n')
}

async function buildCriticalTicketsResponse() {
  const res = await getTickets(null)
  const tickets = res.data || []
  const open = tickets.filter(t => ![5, 6].includes(Number(t.status)))
  const crit = open.filter(t => Number(t.priority) >= 4).sort((a, b) => b.priority - a.priority)

  if (crit.length === 0) return '✅ Nenhum chamado crítico ou de alta prioridade aberto no momento.'

  const lines = [`🔴 CHAMADOS CRÍTICOS / ALTA PRIORIDADE: ${crit.length}`]
  crit.forEach(t => {
    lines.push(`\n• #${t.id} — ${t.title || '(sem título)'}`)
    lines.push(`  Prioridade: ${PRIORITY_LABEL[t.priority] ?? t.priority} · Status: ${t.statusLabel ?? '—'}`)
    lines.push(`  Solicitante: ${t.requester ?? '—'} · Técnico: ${t.assignedTo ?? '(não atribuído)'}`)
    lines.push(`  Aberto em: ${fmtDate(t.openedAt)}`)
  })
  return lines.join('\n')
}

async function buildUnassignedTicketsResponse() {
  const res = await getTickets(null)
  const tickets = res.data || []
  const open    = tickets.filter(t => ![5, 6].includes(Number(t.status)))
  const noTech  = open.filter(t => !t.assignedTo)

  if (noTech.length === 0) return '✅ Todos os chamados abertos têm técnico atribuído.'

  const lines = [`⚠️ CHAMADOS SEM TÉCNICO ATRIBUÍDO: ${noTech.length}`]
  noTech.forEach(t => {
    lines.push(`\n• #${t.id} — ${t.title || '(sem título)'}`)
    lines.push(`  Prioridade: ${PRIORITY_LABEL[t.priority] ?? t.priority} · Solicitante: ${t.requester ?? '—'}`)
    lines.push(`  Aberto em: ${fmtDate(t.openedAt)}`)
  })
  return lines.join('\n')
}

async function buildTicketsResponse() {
  const res     = await getTickets(null)
  const tickets = res.data || []
  const open    = tickets.filter(t => ![5, 6].includes(Number(t.status)))
  const solved  = tickets.filter(t => [5].includes(Number(t.status))).length
  const closed  = tickets.filter(t => [6].includes(Number(t.status))).length
  const crit    = open.filter(t => Number(t.priority) >= 4).length
  const noTech  = open.filter(t => !t.assignedTo).length

  const lines = [
    `📋 CHAMADOS GLPI — VISÃO GERAL`,
    `Total consultado: ${tickets.length}`,
    `Abertos: ${open.length} (${crit} crítico(s), ${noTech} sem técnico)`,
    `Resolvidos: ${solved} · Fechados: ${closed}`,
  ]
  if (open.length > 0) {
    lines.push('\nÚLTIMOS ABERTOS:')
    open.slice(0, 5).forEach(t => {
      lines.push(`• #${t.id} — ${t.title || '(sem título)'} [${PRIORITY_LABEL[t.priority] ?? '—'}] — ${t.assignedTo ?? 'sem técnico'}`)
    })
  }
  return lines.join('\n')
}

async function buildZabbixProblemsResponse() {
  const [proR, hostsR] = await Promise.all([getProblems(), getHosts()])
  const problems = proR.data || []
  const hosts    = hostsR.data || []
  const online   = hosts.filter(h => h.available).length

  if (problems.length === 0) return `✅ Nenhum problema ativo no Zabbix. Hosts: ${online}/${hosts.length} online.`

  const crit    = problems.filter(p => Number(p.severity) >= 4)
  const warning = problems.filter(p => Number(p.severity) < 4)

  const lines = [`🔴 PROBLEMAS ZABBIX: ${problems.length} ativo(s)`]
  lines.push(`Hosts: ${online}/${hosts.length} online`)
  if (crit.length > 0) {
    lines.push(`\nCRÍTICOS / HIGH:`)
    crit.forEach(p => {
      const ago = p.clock ? timeAgo(Number(p.clock)) : ''
      lines.push(`• [${SEV_LABEL[p.severity] ?? p.severity}] ${p.hostName ?? p.hosts?.[0]?.host ?? '—'}: ${p.name}${ago ? ' — ' + ago : ''}`)
    })
  }
  if (warning.length > 0) {
    lines.push(`\nAVISOS:`)
    warning.slice(0, 5).forEach(p => {
      lines.push(`• [${SEV_LABEL[p.severity] ?? p.severity}] ${p.hostName ?? p.hosts?.[0]?.host ?? '—'}: ${p.name}`)
    })
  }
  return lines.join('\n')
}

async function buildExpiringLicensesResponse() {
  const licenses = await getLicenses()
  const today    = new Date()
  const in90     = new Date(today); in90.setDate(today.getDate() + 90)

  const expired  = licenses.filter(l => l.status === 'EXPIRED')
  const expiring = licenses.filter(l => l.status === 'EXPIRING_SOON' || l.status === 'EXPIRING')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

  if (expired.length === 0 && expiring.length === 0)
    return '✅ Nenhuma licença vencida ou próxima do vencimento.'

  const lines = [`📄 LICENÇAS — STATUS DE VENCIMENTO`]
  if (expired.length > 0) {
    lines.push(`\nVENCIDAS (${expired.length}):`)
    expired.forEach(l => lines.push(`• ${l.name}${l.vendor ? ' (' + l.vendor + ')' : ''} — ${fmtDate(l.expiryDate)}`))
  }
  if (expiring.length > 0) {
    lines.push(`\nA VENCER (${expiring.length}):`)
    expiring.forEach(l => lines.push(`• ${l.name}${l.vendor ? ' (' + l.vendor + ')' : ''} — ${fmtDays(l.daysUntilExpiry)} (${fmtDate(l.expiryDate)})`))
  }
  return lines.join('\n')
}

async function buildExpiringContractsResponse() {
  const contracts = await getContracts()
  const expired   = contracts.filter(c => c.status === 'EXPIRED')
  const expiring  = contracts.filter(c => c.status === 'EXPIRING_SOON' || c.status === 'EXPIRING')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

  if (expired.length === 0 && expiring.length === 0)
    return '✅ Nenhum contrato vencido ou próximo do vencimento.'

  const lines = [`📋 CONTRATOS — STATUS DE VENCIMENTO`]
  if (expired.length > 0) {
    lines.push(`\nVENCIDOS (${expired.length}):`)
    expired.forEach(c => lines.push(`• ${c.name}${c.vendor ? ' (' + c.vendor + ')' : ''} — ${fmtDate(c.endDate)}`))
  }
  if (expiring.length > 0) {
    lines.push(`\nA VENCER (${expiring.length}):`)
    expiring.forEach(c => lines.push(`• ${c.name}${c.vendor ? ' (' + c.vendor + ')' : ''} — ${fmtDays(c.daysUntilExpiry)} (${fmtDate(c.endDate)})`))
  }
  return lines.join('\n')
}

async function buildUrlsDownResponse() {
  const monitors = await getMonitors()
  const enabled  = monitors.filter(m => m.enabled)
  const down     = enabled.filter(m => m.lastStatus != null && m.lastStatus >= 400)
  const noCheck  = enabled.filter(m => m.lastStatus == null)
  const up       = enabled.filter(m => m.lastStatus != null && m.lastStatus < 400)

  const lines = [`🌐 MONITOR DE URLs — ${enabled.length} monitoradas`]
  lines.push(`Online: ${up.length} · Com falha: ${down.length} · Sem verificação: ${noCheck.length}`)
  if (down.length > 0) {
    lines.push('\nCOM FALHA:')
    down.forEach(m => lines.push(`• ${m.name} — HTTP ${m.lastStatus}`))
  }
  if (down.length === 0) lines.push('\n✅ Todas as URLs monitoradas estão operacionais.')
  return lines.join('\n')
}

async function buildInventoryMaintenanceResponse() {
  const inventory = await getAllInventory()
  const maint     = inventory.filter(i => i.status === 'MAINTENANCE')

  if (maint.length === 0) return '✅ Nenhum ativo em manutenção no inventário.'

  const lines = [`🔧 ATIVOS EM MANUTENÇÃO: ${maint.length}`]
  maint.forEach(i => {
    lines.push(`\n• ${i.name}${i.tombamento ? ' [' + i.tombamento + ']' : ''}`)
    if (i.brand || i.model) lines.push(`  ${[i.brand, i.model].filter(Boolean).join(' ')}`)
    if (i.location) lines.push(`  Local: ${i.location}`)
  })
  return lines.join('\n')
}

async function buildInventoryIncompleteResponse() {
  const inventory = await getAllInventory()
  const noTomb    = inventory.filter(i => !i.tombamento)
  const noSerial  = inventory.filter(i => !i.serialNumber)

  if (noTomb.length === 0 && noSerial.length === 0)
    return '✅ Todos os ativos do inventário têm tombamento e número de série registrados.'

  const lines = [`📦 ATIVOS COM DADOS INCOMPLETOS`]
  if (noTomb.length > 0) {
    lines.push(`\nSEM TOMBAMENTO (${noTomb.length}):`)
    noTomb.slice(0, 8).forEach(i => lines.push(`• ${i.name} — ${i.type ?? '—'}`))
    if (noTomb.length > 8) lines.push(`  ... e mais ${noTomb.length - 8}`)
  }
  if (noSerial.length > 0) {
    lines.push(`\nSEM NÚMERO DE SÉRIE (${noSerial.length}):`)
    noSerial.slice(0, 8).forEach(i => lines.push(`• ${i.name}${i.tombamento ? ' [' + i.tombamento + ']' : ''}`))
    if (noSerial.length > 8) lines.push(`  ... e mais ${noSerial.length - 8}`)
  }
  return lines.join('\n')
}

function buildHelpResponse() {
  return [
    '🤖 HERMES — COMANDOS DISPONÍVEIS',
    '',
    'Você pode me perguntar sobre:',
    '',
    '📊 OPERAÇÃO',
    '  • "Resumo da operação" — visão geral completa da TI',
    '  • "Quais hosts têm problema?" — alertas Zabbix ativos',
    '  • "URLs com falha" — monitor de disponibilidade',
    '',
    '🎫 CHAMADOS',
    '  • "Chamados críticos" — tickets de alta prioridade',
    '  • "Chamados sem técnico" — tickets sem atribuição',
    '  • "Visão geral de chamados" — resumo do GLPI',
    '',
    '📄 CONTRATOS E LICENÇAS',
    '  • "Licenças vencendo" — status de vencimento',
    '  • "Contratos vencendo" — contratos a vencer',
    '',
    '📦 INVENTÁRIO',
    '  • "Ativos em manutenção" — equipamentos em reparo',
    '  • "Ativos sem tombamento" — dados incompletos',
    '',
    'Dica: use linguagem natural, não precisa ser exato.',
  ].join('\n')
}

function timeAgo(unixSec) {
  const diff = Math.floor(Date.now() / 1000) - unixSec
  if (diff < 60)    return `${diff}s atrás`
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

// ─────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────
async function processMessage(text) {
  const intent = detectIntent(text)
  try {
    switch (intent) {
      case 'summary':              return await buildSummaryResponse()
      case 'critical-tickets':     return await buildCriticalTicketsResponse()
      case 'unassigned-tickets':   return await buildUnassignedTicketsResponse()
      case 'sla-tickets':          return await buildCriticalTicketsResponse()
      case 'expiring-licenses':    return await buildExpiringLicensesResponse()
      case 'expiring-contracts':   return await buildExpiringContractsResponse()
      case 'zabbix-problems':      return await buildZabbixProblemsResponse()
      case 'urls-down':            return await buildUrlsDownResponse()
      case 'inventory-maintenance':return await buildInventoryMaintenanceResponse()
      case 'inventory-incomplete': return await buildInventoryIncompleteResponse()
      case 'tickets':              return await buildTicketsResponse()
      case 'licenses':             return await buildExpiringLicensesResponse()
      case 'contracts':            return await buildExpiringContractsResponse()
      case 'hosts':                return await buildZabbixProblemsResponse()
      case 'inventory':            return await buildInventoryMaintenanceResponse()
      case 'help':                 return buildHelpResponse()
      default:
        return [
          'Não entendi completamente sua pergunta. Tente ser mais específico, ou use um dos atalhos abaixo.',
          '',
          'Exemplos: "resumo da operação", "chamados críticos", "licenças vencendo".',
          'Digite "ajuda" para ver todos os comandos disponíveis.',
        ].join('\n')
    }
  } catch {
    return '⚠️ Não consegui obter os dados. Verifique a conectividade com o backend e as integrações (GLPI, Zabbix).'
  }
}

// ─────────────────────────────────────────────────────────
// QUICK COMMANDS
// ─────────────────────────────────────────────────────────
const QUICK_COMMANDS = [
  { label: 'Resumo da operação',    text: 'Resumo da operação', icon: '📊' },
  { label: 'Chamados críticos',     text: 'Chamados críticos', icon: '🔴' },
  { label: 'Sem técnico',           text: 'Chamados sem técnico', icon: '👤' },
  { label: 'Alertas Zabbix',        text: 'Quais hosts têm problema?', icon: '🖥️' },
  { label: 'Licenças vencendo',     text: 'Licenças vencendo', icon: '📄' },
  { label: 'Contratos vencendo',    text: 'Contratos vencendo', icon: '📋' },
  { label: 'URLs com falha',        text: 'URLs com falha', icon: '🌐' },
  { label: 'Em manutenção',         text: 'Ativos em manutenção', icon: '🔧' },
  { label: 'Ajuda',                 text: 'Ajuda', icon: '❓' },
]

const WELCOME = [
  'Olá! Sou o Hermes, assistente operacional de TI do NexusIT.',
  '',
  'Posso consultar chamados, alertas, licenças, contratos, inventário e muito mais em tempo real.',
  '',
  'Tente: "Resumo da operação" para uma visão completa, ou clique em um atalho abaixo.',
  'Digite "ajuda" para ver todos os comandos disponíveis.',
].join('\n')

// ─────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────
export default function HermesPage() {
  const [messages, setMessages] = useState([{ role: 'hermes', text: WELCOME }])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef(null)
  const inputRef                = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }, { role: 'hermes', text: null, loading: true }])
    setLoading(true)

    const response = await processMessage(q)

    setMessages(prev => {
      const next = [...prev]
      next[next.length - 1] = { role: 'hermes', text: response }
      return next
    })
    setLoading(false)
    inputRef.current?.focus()
  }, [input, loading])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <Layout>
      <div className="page" style={{ height: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Header */}
        <div className="page-header" style={{ flexShrink: 0 }}>
          <div className="page-header-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px var(--accent-glow)',
              }}>
                <HermesIcon />
              </div>
              <div>
                <h1 style={{ margin: 0 }}>NexusAI · Hermes</h1>
                <p style={{ margin: 0 }}>Assistente operacional de TI</p>
              </div>
            </div>
          </div>
          <span className="badge" style={{ background: 'var(--accent)', color: 'var(--text-inverse)', padding: '3px 10px', fontSize: 11 }}>
            NexusAI
          </span>
        </div>

        {/* Quick Commands */}
        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_COMMANDS.map(cmd => (
              <button
                key={cmd.text}
                onClick={() => send(cmd.text)}
                disabled={loading}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: '1px solid var(--border)', background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.15s',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <span>{cmd.icon}</span>{cmd.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
          padding: '4px 2px', minHeight: 0,
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {msg.role === 'hermes' && (
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginRight: 8, marginTop: 2,
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <HermesIcon size={13} />
                </div>
              )}
              <div style={{
                maxWidth: '78%',
                background: msg.role === 'user'
                  ? 'var(--accent)'
                  : 'var(--bg-surface)',
                color: msg.role === 'user' ? 'var(--text-inverse)' : 'var(--text-primary)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                padding: '10px 14px',
                boxShadow: 'var(--shadow-xs)',
              }}>
                {msg.loading ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                        animation: `bounce 1.2s ${j * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                ) : (
                  <pre style={{
                    margin: 0, fontSize: 13, lineHeight: 1.65,
                    fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    color: msg.role === 'user' ? 'var(--text-inverse)' : 'var(--text-primary)',
                  }}>
                    {msg.text}
                  </pre>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          flexShrink: 0, marginTop: 12,
          display: 'flex', gap: 8, alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            placeholder="Pergunte ao Hermes... (Enter para enviar)"
            style={{
              flex: 1, resize: 'none', padding: '10px 14px',
              borderRadius: 12, border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontSize: 13, lineHeight: 1.5, outline: 'none',
              fontFamily: 'inherit',
              maxHeight: 120, overflow: 'auto',
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="btn btn-primary"
            style={{ borderRadius: 12, padding: '10px 18px', flexShrink: 0 }}
          >
            <SendIcon />
          </button>
        </div>

        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
            40%            { transform: scale(1);   opacity: 1;   }
          }
        `}</style>
      </div>
    </Layout>
  )
}

function HermesIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

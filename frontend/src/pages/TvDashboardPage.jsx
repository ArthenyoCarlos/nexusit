import { useState, useEffect, useRef, useCallback } from 'react'
import { getHosts, getProblems } from '../services/monitoring'
import { getTickets } from '../services/glpi'

function useAlertSound() {
  const muted = useRef(false)

  const play = useCallback((severity) => {
    if (muted.current) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      if (severity >= 5) {
        // Disaster: 3 urgent beeps
        osc.type = 'square'
        const t = ctx.currentTime
        gain.gain.setValueAtTime(0, t)
        ;[0, 0.25, 0.5].forEach(offset => {
          gain.gain.linearRampToValueAtTime(0.4, t + offset + 0.01)
          gain.gain.linearRampToValueAtTime(0, t + offset + 0.18)
        })
        osc.frequency.setValueAtTime(880, t)
        osc.start(t)
        osc.stop(t + 0.8)
      } else if (severity >= 3) {
        // Average/High: 2 medium beeps
        osc.type = 'sine'
        const t = ctx.currentTime
        gain.gain.setValueAtTime(0, t)
        ;[0, 0.3].forEach(offset => {
          gain.gain.linearRampToValueAtTime(0.25, t + offset + 0.01)
          gain.gain.linearRampToValueAtTime(0, t + offset + 0.2)
        })
        osc.frequency.setValueAtTime(660, t)
        osc.start(t)
        osc.stop(t + 0.6)
      } else {
        // Info/Warning: 1 soft beep
        osc.type = 'sine'
        const t = ctx.currentTime
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.15, t + 0.01)
        gain.gain.linearRampToValueAtTime(0, t + 0.25)
        osc.frequency.setValueAtTime(520, t)
        osc.start(t)
        osc.stop(t + 0.35)
      }

      osc.onended = () => ctx.close()
    } catch { /* AudioContext not available */ }
  }, [])

  return { play, muted }
}

const SEVERITY = {
  5: { label: 'Disaster', text: 'text-red-400',    counter: 'text-red-400',    border: 'border-red-500/50',    bg: 'bg-red-950/40' },
  4: { label: 'High',     text: 'text-orange-400', counter: 'text-orange-400', border: 'border-orange-500/50', bg: 'bg-orange-950/40' },
  3: { label: 'Average',  text: 'text-yellow-400', counter: 'text-yellow-400', border: 'border-yellow-500/50', bg: 'bg-yellow-950/40' },
  2: { label: 'Warning',  text: 'text-blue-400',   counter: 'text-blue-400',   border: 'border-blue-500/50',   bg: 'bg-blue-950/40' },
  1: { label: 'Info',     text: 'text-slate-400',  counter: 'text-slate-400',  border: 'border-slate-500/50',  bg: 'bg-slate-800/40' },
}
const SEVERITY_ORDER = [5, 4, 3, 2, 1]

// Ticket priority: 6=Crítica 5=Muito Alta 4=Alta 3=Média 2=Baixa 1=Muito Baixa
const TICKET_PRIORITY = {
  6: { label: 'Crítica',    text: 'text-red-400',    bg: 'bg-red-950/40',    border: 'border-red-500/50'    },
  5: { label: 'Muito Alta', text: 'text-red-400',    bg: 'bg-red-950/30',    border: 'border-red-500/30'    },
  4: { label: 'Alta',       text: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-500/50' },
  3: { label: 'Média',      text: 'text-yellow-400', bg: 'bg-yellow-950/40', border: 'border-yellow-500/50' },
  2: { label: 'Baixa',      text: 'text-blue-400',   bg: 'bg-blue-950/30',   border: 'border-blue-500/30'   },
  1: { label: 'M. Baixa',   text: 'text-slate-400',  bg: 'bg-slate-800/30',  border: 'border-slate-500/30'  },
}
const TICKET_PRIORITY_ORDER = [6, 5, 4, 3, 2, 1]

function formatUptime(seconds) {
  if (!seconds) return null
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}

function useDashboardData(onNewAlerts) {
  const [hosts, setHosts] = useState([])
  const [problems, setProblems] = useState([])
  const [tickets, setTickets] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [stale, setStale] = useState(false)
  const cache = useRef({ hosts: [], problems: [], tickets: [] })
  const knownProblemIds = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const [hostsRes, problemsRes, ticketsRes] = await Promise.allSettled([
        getHosts(),
        getProblems(),
        getTickets(),
      ])
      const newHosts    = hostsRes.status    === 'fulfilled' ? hostsRes.value.data    : cache.current.hosts
      const newProblems = problemsRes.status === 'fulfilled' ? problemsRes.value.data : cache.current.problems
      const newTickets  = ticketsRes.status  === 'fulfilled' ? ticketsRes.value.data  : cache.current.tickets

      // Detect new problems since last fetch
      if (knownProblemIds.current !== null && problemsRes.status === 'fulfilled') {
        const newIds = newProblems.filter(p => !knownProblemIds.current.has(p.id))
        if (newIds.length > 0) {
          const maxSev = Math.max(...newIds.map(p => p.severity))
          onNewAlerts?.(maxSev)
        }
      }
      if (problemsRes.status === 'fulfilled') {
        knownProblemIds.current = new Set(newProblems.map(p => p.id))
      }

      cache.current = { hosts: newHosts, problems: newProblems, tickets: newTickets }
      setHosts(newHosts)
      setProblems(newProblems)
      setTickets(newTickets)
      setLastUpdate(new Date())
      setStale(false)
    } catch {
      setHosts(cache.current.hosts)
      setProblems(cache.current.problems)
      setTickets(cache.current.tickets)
      setStale(true)
    }
  }, [onNewAlerts])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { hosts, problems, tickets, lastUpdate, stale }
}

function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  return time
}

export default function TvDashboardPage() {
  const { play, muted } = useAlertSound()
  const [isMuted, setIsMuted] = useState(false)
  const toggleMute = () => {
    muted.current = !muted.current
    setIsMuted(muted.current)
  }

  const handleNewAlerts = useCallback((maxSeverity) => {
    play(maxSeverity)
  }, [play])

  const { hosts, problems, tickets, lastUpdate, stale } = useDashboardData(handleNewAlerts)
  const clock = useClock()

  const availableHosts = hosts.filter(h => h.available)
  const downHosts = hosts.filter(h => !h.available)

  const problemsBySev = SEVERITY_ORDER.reduce((acc, sev) => {
    acc[sev] = problems.filter(p => p.severity === sev).length
    return acc
  }, {})

  const ticketsByPriority = TICKET_PRIORITY_ORDER.reduce((acc, p) => {
    acc[p] = tickets.filter(t => t.priority === p).length
    return acc
  }, {})

  const recentTickets = [...tickets]
    .sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt))
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">N</div>
          <span className="text-xl font-semibold tracking-tight">NexusIT Monitor</span>
          <div className={`ml-4 flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
            stale ? 'bg-yellow-900/50 text-yellow-400' : 'bg-green-900/50 text-green-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${stale ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`} />
            {stale
              ? `Última atualização: ${lastUpdate?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) ?? '—'}`
              : 'Ao vivo'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={toggleMute}
            title={isMuted ? 'Ativar som' : 'Silenciar'}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              color: isMuted ? '#64748b' : '#94a3b8', fontSize: 18, lineHeight: 1,
            }}
          >
            {isMuted ? '🔇' : '🔔'}
          </button>
          <div className="text-right">
            <p className="text-3xl font-mono font-semibold tabular-nums tracking-tight">
              {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs text-slate-500">
              {clock.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-rows-[auto_auto_1fr] gap-5 p-8">

        {/* Row 1 — Hosts + Zabbix Alerts side by side */}
        <div className="grid grid-cols-[1fr_auto] gap-6">

          {/* Section 1 — Hosts */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Status dos Hosts</h2>
              <span className="text-xs text-slate-600">
                {availableHosts.length} online / {downHosts.length} offline
              </span>
            </div>
            {hosts.length === 0 ? (
              <p className="text-slate-600 text-sm">Aguardando dados do Zabbix...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hosts.map(host => (
                  <div key={host.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      host.available
                        ? 'bg-green-950/40 border-green-700/50'
                        : 'bg-red-950/40 border-red-700/50'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      host.available ? 'bg-green-400' : 'bg-red-500 animate-pulse'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-white leading-tight">{host.name}</p>
                      {host.ip && <p className="text-xs text-slate-500 leading-tight">{host.ip}</p>}
                    </div>
                    {host.uptimeSeconds != null && (
                      <span className="text-xs text-slate-500 ml-1">{formatUptime(host.uptimeSeconds)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2 — Zabbix Alert Counters (compact vertical) */}
          <section className="flex-shrink-0">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Alertas Zabbix</h2>
            <div className="flex gap-2">
              {SEVERITY_ORDER.map(sev => {
                const s = SEVERITY[sev]
                const count = problemsBySev[sev]
                return (
                  <div key={sev} className={`border rounded-xl px-4 py-3 text-center min-w-[72px] ${s.bg} ${s.border}`}>
                    <p className={`text-4xl font-bold tabular-nums ${s.counter} ${count > 0 ? '' : 'opacity-30'}`}>
                      {count}
                    </p>
                    <p className={`text-xs mt-0.5 font-medium ${s.text} ${count > 0 ? '' : 'opacity-40'}`}>
                      {s.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Row 2 — GLPI Ticket counters */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Chamados GLPI</h2>
            <span className="text-xs text-slate-600">{tickets.length} aberto(s)</span>
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-6">
            {/* Priority counters */}
            <div className="flex gap-2">
              {TICKET_PRIORITY_ORDER.filter(p => p >= 3).map(p => {
                const cfg = TICKET_PRIORITY[p]
                const count = ticketsByPriority[p]
                return (
                  <div key={p} className={`border rounded-xl px-4 py-3 text-center min-w-[72px] ${cfg.bg} ${cfg.border}`}>
                    <p className={`text-4xl font-bold tabular-nums ${cfg.text} ${count > 0 ? '' : 'opacity-30'}`}>
                      {count}
                    </p>
                    <p className={`text-xs mt-0.5 font-medium ${cfg.text} ${count > 0 ? '' : 'opacity-40'}`}>
                      {cfg.label}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Recent tickets */}
            <div className="space-y-1.5">
              {recentTickets.length === 0 ? (
                <p className="text-slate-600 text-sm">Nenhum chamado aberto.</p>
              ) : recentTickets.map(t => {
                const cfg = TICKET_PRIORITY[t.priority] || TICKET_PRIORITY[3]
                return (
                  <div key={t.id}
                    className={`flex items-center justify-between px-4 py-2 rounded-lg border ${cfg.bg} ${cfg.border}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-bold flex-shrink-0 ${cfg.text}`}>#{t.id}</span>
                      <p className="text-sm text-white truncate">{t.title}</p>
                    </div>
                    <span className={`text-xs flex-shrink-0 ml-3 font-medium ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Row 3 — Active Zabbix Problems */}
        <section className="overflow-hidden flex flex-col">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Problemas Zabbix
            {problems.length > 0 && <span className="ml-2 text-red-400">({problems.length})</span>}
          </h2>
          {problems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-3">✓</div>
                <p className="text-green-400 font-semibold text-xl">Tudo operacional</p>
                <p className="text-slate-500 text-sm mt-1">Nenhum alerta ativo</p>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 space-y-1.5">
              {problems.map(p => {
                const s = SEVERITY[p.severity] || SEVERITY[1]
                return (
                  <div key={p.id}
                    className={`flex items-center justify-between px-5 py-2.5 rounded-lg border ${s.bg} ${s.border}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${s.text}`}>
                        {s.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.hostName}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-4">
                      {new Date(p.clock * 1000).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { getHosts, getProblems } from '../services/monitoring'
import { getTickets } from '../services/glpi'

/* ─── Sound ─────────────────────────────────────────────────────────────── */
function useAlertSound() {
  const muted = useRef(false)
  const play = useCallback((severity) => {
    if (muted.current) return
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      if (severity >= 5) {
        osc.type = 'square'
        const t = ctx.currentTime
        gain.gain.setValueAtTime(0, t)
        ;[0, 0.25, 0.5].forEach(o => {
          gain.gain.linearRampToValueAtTime(0.4, t + o + 0.01)
          gain.gain.linearRampToValueAtTime(0, t + o + 0.18)
        })
        osc.frequency.setValueAtTime(880, t); osc.start(t); osc.stop(t + 0.8)
      } else if (severity >= 3) {
        osc.type = 'sine'
        const t = ctx.currentTime
        gain.gain.setValueAtTime(0, t)
        ;[0, 0.3].forEach(o => {
          gain.gain.linearRampToValueAtTime(0.25, t + o + 0.01)
          gain.gain.linearRampToValueAtTime(0, t + o + 0.2)
        })
        osc.frequency.setValueAtTime(660, t); osc.start(t); osc.stop(t + 0.6)
      } else {
        osc.type = 'sine'
        const t = ctx.currentTime
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.15, t + 0.01)
        gain.gain.linearRampToValueAtTime(0, t + 0.25)
        osc.frequency.setValueAtTime(520, t); osc.start(t); osc.stop(t + 0.35)
      }
      osc.onended = () => ctx.close()
    } catch {}
  }, [])
  return { play, muted }
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const SEV = {
  5: { label: 'DISASTER', color: '#f87171', dimColor: '#7f1d1d', border: 'rgba(239,68,68,.35)',  glow: '0 0 18px rgba(239,68,68,.4)' },
  4: { label: 'HIGH',     color: '#fb923c', dimColor: '#7c2d12', border: 'rgba(249,115,22,.35)', glow: '0 0 14px rgba(249,115,22,.3)' },
  3: { label: 'AVERAGE',  color: '#fbbf24', dimColor: '#78350f', border: 'rgba(251,191,36,.3)',  glow: '' },
  2: { label: 'WARNING',  color: '#60a5fa', dimColor: '#1e3a5f', border: 'rgba(96,165,250,.3)',  glow: '' },
  1: { label: 'INFO',     color: '#94a3b8', dimColor: '#1e293b', border: 'rgba(148,163,184,.2)', glow: '' },
}
const SEV_ORDER = [5, 4, 3, 2, 1]

const PRI = {
  6: { label: 'Crítica',    color: '#f87171', border: 'rgba(239,68,68,.35)'  },
  5: { label: 'Muito Alta', color: '#fb923c', border: 'rgba(249,115,22,.3)'  },
  4: { label: 'Alta',       color: '#fbbf24', border: 'rgba(251,191,36,.25)' },
  3: { label: 'Média',      color: '#60a5fa', border: 'rgba(96,165,250,.25)' },
  2: { label: 'Baixa',      color: '#94a3b8', border: 'rgba(148,163,184,.2)' },
  1: { label: 'M. Baixa',   color: '#64748b', border: 'rgba(100,116,139,.2)' },
}
const PRI_ORDER = [6, 5, 4, 3, 2, 1]

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function formatUptime(sec) {
  if (!sec) return null
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h` : `${h}h`
}

function timeActive(clockSec) {
  if (!clockSec) return ''
  const diff = Math.floor(Date.now() / 1000) - Number(clockSec)
  if (diff < 60)    return `${diff}s`
  if (diff < 3600)  return `${Math.floor(diff/60)}min`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ${Math.floor((diff%3600)/60)}min`
  return `${Math.floor(diff/86400)}d`
}

/* ─── Event detection ────────────────────────────────────────────────────── */
function problemKey(p) {
  return String(p?.id ?? p?.problemid ?? p?.eventid ?? `${p?.hostName ?? p?.hosts?.[0]?.host ?? 'host'}:${p?.name ?? 'problem'}:${p?.clock ?? ''}`)
}

function ticketKey(t) {
  return String(t?.id ?? t?.ticketId ?? `${t?.title ?? t?.name ?? 'ticket'}:${t?.openedAt ?? ''}`)
}

function problemTitle(p) {
  return p?.name ?? p?.title ?? 'Alerta Zabbix'
}

function problemHost(p) {
  return p?.hostName ?? p?.hosts?.[0]?.host ?? p?.host ?? ''
}

function ticketTitle(t) {
  return t?.title ?? t?.name ?? 'Chamado GLPI'
}

function buildDashboardEvents(previous, current) {
  if (!previous) return []

  const events = []
  const previousProblems = new Map(previous.problems.map(p => [problemKey(p), p]))
  const currentProblems = new Map(current.problems.map(p => [problemKey(p), p]))
  const previousTickets = new Map(previous.tickets.map(t => [ticketKey(t), t]))
  const currentTickets = new Map(current.tickets.map(t => [ticketKey(t), t]))

  for (const [key, p] of currentProblems) {
    if (!previousProblems.has(key)) {
      events.push({
        id: `problem:new:${key}:${Date.now()}`,
        type: 'problem-new',
        title: 'Novo alerta Zabbix',
        subject: problemTitle(p),
        detail: problemHost(p),
        severity: Number(p?.severity ?? 1),
        tone: 'danger',
        happenedAt: new Date()
      })
    }
  }

  for (const [key, p] of previousProblems) {
    if (!currentProblems.has(key)) {
      events.push({
        id: `problem:resolved:${key}:${Date.now()}`,
        type: 'problem-resolved',
        title: 'Alerta resolvido',
        subject: problemTitle(p),
        detail: problemHost(p),
        severity: Number(p?.severity ?? 1),
        tone: 'success',
        happenedAt: new Date()
      })
    }
  }

  for (const [key, t] of currentTickets) {
    if (!previousTickets.has(key)) {
      events.push({
        id: `ticket:new:${key}:${Date.now()}`,
        type: 'ticket-new',
        title: 'Novo chamado GLPI',
        subject: `#${t?.id ?? key} · ${ticketTitle(t)}`,
        detail: t?.requester ? `Solicitante: ${t.requester}` : (t?.priorityLabel ? `Prioridade: ${t.priorityLabel}` : ''),
        severity: Number(t?.priority ?? 3),
        tone: 'warning',
        happenedAt: new Date()
      })
    }
  }

  for (const [key, t] of previousTickets) {
    if (!currentTickets.has(key)) {
      events.push({
        id: `ticket:resolved:${key}:${Date.now()}`,
        type: 'ticket-resolved',
        title: 'Chamado resolvido/fechado',
        subject: `#${t?.id ?? key} · ${ticketTitle(t)}`,
        detail: t?.assignedTo ? `Responsável: ${t.assignedTo}` : (t?.statusLabel ? `Status anterior: ${t.statusLabel}` : ''),
        severity: Number(t?.priority ?? 1),
        tone: 'success',
        happenedAt: new Date()
      })
    }
  }

  return events
}

/* ─── Data hook ──────────────────────────────────────────────────────────── */
function useDashboardData(onDashboardEvents) {
  const [hosts, setHosts]       = useState([])
  const [problems, setProblems] = useState([])
  const [tickets, setTickets]   = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [stale, setStale]       = useState(false)
  const cache = useRef({ hosts: [], problems: [], tickets: [] })
  const lastSnapshot = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const [hR, pR, tR] = await Promise.allSettled([getHosts(), getProblems(), getTickets()])
      const h = hR.status === 'fulfilled' ? hR.value.data : cache.current.hosts
      const p = pR.status === 'fulfilled' ? pR.value.data : cache.current.problems
      const t = tR.status === 'fulfilled' ? tR.value.data : cache.current.tickets

      const currentSnapshot = { hosts: h, problems: p, tickets: t }
      if (pR.status === 'fulfilled' && tR.status === 'fulfilled') {
        const events = buildDashboardEvents(lastSnapshot.current, currentSnapshot)
        if (events.length > 0) onDashboardEvents?.(events)
        lastSnapshot.current = currentSnapshot
      }

      cache.current = currentSnapshot
      setHosts(h); setProblems(p); setTickets(t)
      setLastUpdate(new Date()); setStale(false)
    } catch {
      setHosts(cache.current.hosts); setProblems(cache.current.problems); setTickets(cache.current.tickets)
      setStale(true)
    }
  }, [onDashboardEvents])

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id) }, [fetchData])
  return { hosts, problems, tickets, lastUpdate, stale }
}

function useClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return t
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function SevCounter({ sev, count }) {
  const s = SEV[sev]
  const active = count > 0
  return (
    <div style={{
      textAlign: 'center', minWidth: 80, padding: '12px 16px', borderRadius: 16,
      border: `1px solid ${active ? s.border : 'rgba(255,255,255,.08)'}`,
      background: active ? `linear-gradient(135deg, ${s.dimColor}cc, rgba(31,22,51,.72))` : 'rgba(255,255,255,.045)',
      boxShadow: active ? `${s.glow}, inset 0 1px 0 rgba(255,255,255,.08)` : 'inset 0 1px 0 rgba(255,255,255,.05)',
      transition: 'all .4s',
    }}>
      <p style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: active ? s.color : '#79628c' }}>{count}</p>
      <p style={{ fontSize: 10, fontWeight: 850, letterSpacing: '0.10em', marginTop: 5, color: active ? s.color : '#8d7ca8' }}>{s.label}</p>
    </div>
  )
}

function PriCounter({ pri, count }) {
  const p = PRI[pri]
  const active = count > 0
  return (
    <div style={{
      textAlign: 'center', minWidth: 72, padding: '10px 12px', borderRadius: 14,
      border: `1px solid ${active ? p.border : 'rgba(255,255,255,.08)'}`,
      background: active ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.035)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)'
    }}>
      <p style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: active ? p.color : '#79628c' }}>{count}</p>
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', marginTop: 4, color: active ? p.color : '#8d7ca8' }}>{p.label}</p>
    </div>
  )
}

function HostChip({ host }) {
  const up = host.available
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 13,
      border: `1px solid ${up ? 'rgba(194,239,78,.24)' : 'rgba(248,113,113,.42)'}`,
      background: up ? 'linear-gradient(135deg, rgba(194,239,78,.10), rgba(255,255,255,.045))' : 'linear-gradient(135deg, rgba(127,29,29,.55), rgba(31,22,51,.62))',
      boxShadow: up ? 'inset 0 1px 0 rgba(255,255,255,.05)' : '0 0 18px rgba(239,68,68,.18), inset 0 1px 0 rgba(255,255,255,.06)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: up ? '#c2ef4e' : '#f87171',
        boxShadow: up ? '0 0 8px #c2ef4e' : '0 0 8px #f87171',
        animation: up ? 'none' : 'pulse 1.5s infinite',
      }} />
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: '#f7f2ff', lineHeight: 1.2 }}>{host.name}</p>
        {host.ip && <p style={{ fontSize: 11, color: '#9c8bb5', lineHeight: 1.2 }}>{host.ip}</p>}
      </div>
      {host.uptimeSeconds != null && (
        <span style={{ fontSize: 10.5, color: up ? '#4ade80' : '#f87171', marginLeft: 4, fontWeight: 500 }}>
          {formatUptime(host.uptimeSeconds)}
        </span>
      )}
    </div>
  )
}

function ProblemRow({ p }) {
  const s = SEV[p.severity] || SEV[1]
  const active = timeActive(p.clock)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', borderRadius: 15,
      border: `1px solid ${s.border}`,
      background: `linear-gradient(135deg, ${s.dimColor}77, rgba(31,22,51,.62))`,
      boxShadow: p.severity >= 4 ? `${s.glow}, inset 0 1px 0 rgba(255,255,255,.06)` : 'inset 0 1px 0 rgba(255,255,255,.05)',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', padding: '3px 8px',
        borderRadius: 6, border: `1px solid ${s.border}`, color: s.color, flexShrink: 0,
        background: `${s.dimColor}99`,
      }}>{s.label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 650, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
        <p style={{ fontSize: 11, color: '#9c8bb5', marginTop: 2 }}>{p.hostName ?? p.hosts?.[0]?.host}</p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {active && <p style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{active}</p>}
        <p style={{ fontSize: 10.5, color: '#475569' }}>{p.clock ? new Date(Number(p.clock)*1000).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : ''}</p>
      </div>
    </div>
  )
}

function TicketRow({ t }) {
  const p = PRI[t.priority] || PRI[3]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14,
      border: `1px solid ${p.border}`, background: 'rgba(255,255,255,.055)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)'
    }}>
      <span style={{ fontSize: 11, fontWeight: 850, color: p.color, flexShrink: 0 }}>#{t.id}</span>
      <p style={{ flex: 1, fontSize: 12.5, color: '#f7f2ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{t.name ?? t.title}</p>
      <span style={{ fontSize: 11, fontWeight: 600, color: p.color, flexShrink: 0 }}>{p.label}</span>
    </div>
  )
}

function EventOverlay({ event }) {
  if (!event) return null
  const palette = {
    danger:  { icon: '🚨', color: '#f87171', border: 'rgba(248,113,113,.55)', bg: 'rgba(127,29,29,.93)', shadow: '0 0 80px rgba(239,68,68,.35)' },
    warning: { icon: '📋', color: '#fbbf24', border: 'rgba(251,191,36,.5)',  bg: 'rgba(120,53,15,.93)', shadow: '0 0 70px rgba(251,191,36,.25)' },
    success: { icon: '✅', color: '#4ade80', border: 'rgba(74,222,128,.45)',  bg: 'rgba(20,83,45,.93)', shadow: '0 0 70px rgba(74,222,128,.25)' },
  }[event.tone] ?? { icon: 'ℹ️', color: '#60a5fa', border: 'rgba(96,165,250,.45)', bg: 'rgba(30,58,138,.93)', shadow: '0 0 70px rgba(96,165,250,.25)' }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at center, rgba(15,23,42,.45), rgba(2,8,23,.9))',
      backdropFilter: 'blur(3px)', animation: 'overlayShow .25s ease-out', pointerEvents: 'none'
    }}>
      <div style={{
        width: 'min(980px, 86vw)', borderRadius: 28, padding: '44px 52px',
        background: `linear-gradient(135deg, ${palette.bg}, rgba(2,8,23,.96))`,
        border: `2px solid ${palette.border}`, boxShadow: palette.shadow,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 76, lineHeight: 1, marginBottom: 18 }}>{palette.icon}</div>
        <p style={{
          fontSize: 18, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: palette.color, marginBottom: 14
        }}>{event.title}</p>
        <h1 style={{
          fontSize: 40, lineHeight: 1.15, fontWeight: 850, color: '#f8fafc',
          margin: '0 auto 16px', maxWidth: 860
        }}>{event.subject}</h1>
        {event.detail && <p style={{ fontSize: 22, color: '#cbd5e1', marginBottom: 18 }}>{event.detail}</p>}
        {event.count > 1 && <p style={{ fontSize: 16, color: palette.color, fontWeight: 800, marginBottom: 14 }}>+{event.count - 1} outro(s) evento(s) no mesmo ciclo</p>}
        <p style={{ fontSize: 15, color: '#94a3b8' }}>
          {event.happenedAt?.toLocaleTimeString?.('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · esta tela some automaticamente em 10 segundos
        </p>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function TvDashboardPage() {
  const { play, muted } = useAlertSound()
  const [isMuted, setIsMuted] = useState(false)
  const [activeEvent, setActiveEvent] = useState(null)
  const overlayTimer = useRef(null)
  const toggleMute = () => { muted.current = !muted.current; setIsMuted(muted.current) }

  const showDashboardEvents = useCallback((events) => {
    if (!events?.length) return
    const topEvent = [...events].sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))[0]
    setActiveEvent({ ...topEvent, count: events.length })
    play(topEvent.tone === 'success' ? 1 : topEvent.severity)
    if (overlayTimer.current) clearTimeout(overlayTimer.current)
    overlayTimer.current = setTimeout(() => setActiveEvent(null), 10000)
  }, [play])

  useEffect(() => () => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current)
  }, [])

  const { hosts, problems, tickets, lastUpdate, stale } = useDashboardData(showDashboardEvents)
  const clock = useClock()

  const online  = hosts.filter(h => h.available)
  const offline = hosts.filter(h => !h.available)
  const pctOnline = hosts.length ? Math.round((online.length / hosts.length) * 100) : 100

  const bySev = SEV_ORDER.reduce((a, s) => { a[s] = problems.filter(p => p.severity === s).length; return a }, {})
  const byPri = PRI_ORDER.reduce((a, p) => { a[p] = tickets.filter(t => t.priority === p).length;  return a }, {})
  const sortedProblems = [...problems].sort((a, b) => b.severity - a.severity || Number(b.clock) - Number(a.clock))
  const recentTickets  = [...tickets].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt)).slice(0, 6)

  const hasCritical = problems.some(p => p.severity >= 4)

  return (
    <div style={{
      minHeight: '100vh', color: '#f7f2ff', fontFamily: 'Inter, Rubik, system-ui, -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: `
        radial-gradient(circle at 13% 8%, rgba(106,95,193,.36), transparent 28%),
        radial-gradient(circle at 88% 12%, rgba(194,239,78,.13), transparent 24%),
        radial-gradient(circle at 55% 100%, rgba(59,130,246,.16), transparent 30%),
        linear-gradient(135deg, #150f23 0%, #1f1633 46%, #0f172a 100%)`
    }}>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes overlayShow { from{opacity:0;transform:scale(.98)} to{opacity:1;transform:scale(1)} }
        @keyframes shimmer { 0%{transform:translateX(-120%)} 100%{transform:translateX(120%)} }
        .tv-row { animation: fadein .3s ease }
        .tv-panel-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .tv-panel-scroll::-webkit-scrollbar-thumb { background: rgba(121,98,140,.6); border-radius: 999px; }
        .tv-panel-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,.04); }
      `}</style>

      <EventOverlay event={activeEvent} />

      {/* ── Header ── */}
      <header style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 32px', flexShrink: 0, overflow: 'hidden',
        borderBottom: '1px solid rgba(194,239,78,.13)',
        background: 'linear-gradient(90deg, rgba(31,22,51,.88), rgba(21,15,35,.62))',
        boxShadow: '0 18px 50px rgba(0,0,0,.22)', backdropFilter: 'blur(18px) saturate(160%)'
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .55, background: 'linear-gradient(110deg, transparent 0%, rgba(255,255,255,.08) 35%, transparent 62%)', animation: 'shimmer 9s linear infinite' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg,#c2ef4e,#6a5fc1 55%,#422082)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: 18,
            color: '#150f23', boxShadow: '0 0 34px rgba(106,95,193,.42), inset 0 1px 0 rgba(255,255,255,.45)'
          }}>N</div>
          <div>
            <span style={{ fontSize: 20, fontWeight: 850, letterSpacing: '-0.03em', color: '#fff' }}>NexusIT Monitor</span>
            <p style={{ fontSize: 11, color: '#a99ac0', marginTop: 2, letterSpacing: '.18em', textTransform: 'uppercase' }}>TV Operacional · Armazém Galdino</p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, padding: '6px 12px', borderRadius: 999,
            background: stale ? 'rgba(251,191,36,.12)' : 'rgba(194,239,78,.10)',
            color: stale ? '#fbbf24' : '#c2ef4e',
            border: `1px solid ${stale ? 'rgba(251,191,36,.30)' : 'rgba(194,239,78,.25)'}`,
            boxShadow: stale ? 'none' : '0 0 24px rgba(194,239,78,.10)'
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: stale ? '#fbbf24' : '#c2ef4e', animation: stale ? 'none' : 'pulse 2s infinite' }} />
            {stale ? `Atualizado ${lastUpdate?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Ao vivo'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22, position: 'relative', zIndex: 1 }}>
          {/* Uptime bar */}
          {hosts.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 14,
              background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.11)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)'
            }}>
              <span style={{ fontSize: 12, color: '#c7badb', fontWeight: 650 }}>{online.length}/{hosts.length} hosts</span>
              <div style={{ width: 138, height: 8, borderRadius: 99, background: 'rgba(0,0,0,.28)', overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ height: '100%', width: `${pctOnline}%`, background: pctOnline === 100 ? 'linear-gradient(90deg,#86efac,#c2ef4e)' : pctOnline >= 80 ? 'linear-gradient(90deg,#fbbf24,#ffb287)' : 'linear-gradient(90deg,#fb7185,#ef4444)', borderRadius: 99, transition: 'width .6s', boxShadow: pctOnline === 100 ? '0 0 12px rgba(194,239,78,.5)' : '' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, color: pctOnline === 100 ? '#c2ef4e' : pctOnline >= 80 ? '#fbbf24' : '#f87171' }}>{pctOnline}%</span>
            </div>
          )}

          <button onClick={toggleMute} style={{ background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.13)', borderRadius: 12, padding: '8px 13px', cursor: 'pointer', color: isMuted ? '#79628c' : '#f7f2ff', fontSize: 17, boxShadow: '0 8px 20px rgba(0,0,0,.16)' }}>
            {isMuted ? '🔇' : '🔔'}
          </button>

          <div style={{ textAlign: 'right', minWidth: 158 }}>
            <p style={{ fontSize: 35, fontWeight: 850, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.045em', lineHeight: 1, color: hasCritical ? '#f87171' : '#ffffff', textShadow: hasCritical ? '0 0 18px rgba(248,113,113,.35)' : '0 0 18px rgba(194,239,78,.08)' }}>
              {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p style={{ fontSize: 11, color: '#9c8bb5', marginTop: 3, textTransform: 'capitalize' }}>
              {clock.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
        </div>
      </header>

      {/* ── Body: 3-column grid ── */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 420px', gap: 18, overflow: 'hidden', padding: 18 }}>

        {/* COL 1 — Hosts + Tickets */}
        <div className="tv-panel-scroll" style={{
          padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto',
          border: '1px solid rgba(255,255,255,.10)', borderRadius: 22,
          background: 'linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.045))',
          boxShadow: '0 18px 55px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08)',
          backdropFilter: 'blur(18px) saturate(150%)'
        }}>

          {/* Hosts */}
          <section style={{ borderRadius: 18, padding: 14, background: 'rgba(21,15,35,.36)', border: '1px solid rgba(255,255,255,.06)' }}>
            <SectionTitle>Status dos Hosts <Chip>{online.length} online {offline.length > 0 ? `· ${offline.length} offline` : ''}</Chip></SectionTitle>
            {offline.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#f87171', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Offline</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{offline.map(h => <HostChip key={h.id} host={h} />)}</div>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {online.map(h => <HostChip key={h.id} host={h} />)}
            </div>
          </section>

          {/* Tickets */}
          <section style={{ flex: 1, borderRadius: 18, padding: 14, background: 'rgba(21,15,35,.28)', border: '1px solid rgba(255,255,255,.06)' }}>
            <SectionTitle>Chamados GLPI <Chip>{tickets.length} aberto(s)</Chip></SectionTitle>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {PRI_ORDER.filter(p => p >= 3).map(p => <PriCounter key={p} pri={p} count={byPri[p]} />)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {recentTickets.length === 0
                ? <EmptyState>Nenhum chamado aberto</EmptyState>
                : recentTickets.map(t => <TicketRow key={t.id} t={t} />)}
            </div>
          </section>
        </div>

        {/* COL 2 — Problems list */}
        <div className="tv-panel-scroll" style={{
          padding: '20px 22px', display: 'flex', flexDirection: 'column', overflowY: 'hidden',
          border: '1px solid rgba(255,255,255,.10)', borderRadius: 22,
          background: 'linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04))',
          boxShadow: '0 18px 55px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08)',
          backdropFilter: 'blur(18px) saturate(150%)'
        }}>
          <SectionTitle>
            Problemas Zabbix
            {problems.length > 0 && <span style={{ marginLeft: 8, color: '#f87171', fontWeight: 800 }}>({problems.length})</span>}
          </SectionTitle>
          {problems.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 52, filter: 'grayscale(0)' }}>✓</div>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>Tudo operacional</p>
              <p style={{ fontSize: 13, color: '#475569' }}>Nenhum alerta ativo no Zabbix</p>
            </div>
          ) : (
            <div className="tv-panel-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
              {sortedProblems.map(p => <ProblemRow key={p.id ?? p.problemid} p={p} />)}
            </div>
          )}
        </div>

        {/* COL 3 — Severity counters + summary */}
        <div className="tv-panel-scroll" style={{
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto',
          border: '1px solid rgba(255,255,255,.10)', borderRadius: 22,
          background: 'linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.045))',
          boxShadow: '0 18px 55px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08)',
          backdropFilter: 'blur(18px) saturate(150%)'
        }}>

          {/* Severity counters */}
          <section>
            <SectionTitle>Alertas por Severidade</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SEV_ORDER.map(s => <SevCounter key={s} sev={s} count={bySev[s]} />)}
            </div>
          </section>

          {/* Summary card */}
          <section>
            <SectionTitle>Resumo</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Hosts online',   value: `${online.length} / ${hosts.length}`, color: pctOnline === 100 ? '#4ade80' : '#fbbf24' },
                { label: 'Alertas ativos', value: problems.length, color: problems.length > 0 ? '#f87171' : '#4ade80' },
                { label: 'Críticos/High',  value: (bySev[5] || 0) + (bySev[4] || 0), color: (bySev[5] || 0) + (bySev[4] || 0) > 0 ? '#f87171' : '#4ade80' },
                { label: 'Chamados',       value: tickets.length, color: tickets.length > 0 ? '#fbbf24' : '#4ade80' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.055)', border: '1px solid rgba(255,255,255,.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)' }}>
                  <span style={{ fontSize: 13, color: '#c7badb', fontWeight: 650 }}>{r.label}</span>
                  <span style={{ fontSize: 19, fontWeight: 900, color: r.color, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Last update */}
          {lastUpdate && (
            <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 'auto' }}>
              Atualizado às {lastUpdate.toLocaleTimeString('pt-BR')} · a cada 30s
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c2ef4e', boxShadow: '0 0 14px rgba(194,239,78,.45)' }} />
      <h2 style={{ fontSize: 11, fontWeight: 850, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#d9cced' }}>{children}</h2>
    </div>
  )
}

function Chip({ children }) {
  return <span style={{ fontSize: 11, color: '#9c8bb5', fontWeight: 600, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>{children}</span>
}

function EmptyState({ children }) {
  return <p style={{ fontSize: 13, color: '#9c8bb5', padding: '12px 0' }}>{children}</p>
}

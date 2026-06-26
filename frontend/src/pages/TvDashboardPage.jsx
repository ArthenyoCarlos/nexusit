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

/* ─── Data hook ──────────────────────────────────────────────────────────── */
function useDashboardData(onNewAlerts) {
  const [hosts, setHosts]       = useState([])
  const [problems, setProblems] = useState([])
  const [tickets, setTickets]   = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)
  const [stale, setStale]       = useState(false)
  const cache = useRef({ hosts: [], problems: [], tickets: [] })
  const knownIds = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const [hR, pR, tR] = await Promise.allSettled([getHosts(), getProblems(), getTickets()])
      const h = hR.status === 'fulfilled' ? hR.value.data : cache.current.hosts
      const p = pR.status === 'fulfilled' ? pR.value.data : cache.current.problems
      const t = tR.status === 'fulfilled' ? tR.value.data : cache.current.tickets

      if (knownIds.current !== null && pR.status === 'fulfilled') {
        const newOnes = p.filter(x => !knownIds.current.has(x.id))
        if (newOnes.length > 0) onNewAlerts?.(Math.max(...newOnes.map(x => x.severity)))
      }
      if (pR.status === 'fulfilled') knownIds.current = new Set(p.map(x => x.id))

      cache.current = { hosts: h, problems: p, tickets: t }
      setHosts(h); setProblems(p); setTickets(t)
      setLastUpdate(new Date()); setStale(false)
    } catch {
      setHosts(cache.current.hosts); setProblems(cache.current.problems); setTickets(cache.current.tickets)
      setStale(true)
    }
  }, [onNewAlerts])

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
      textAlign: 'center', minWidth: 80, padding: '12px 16px', borderRadius: 12,
      border: `1px solid ${active ? s.border : 'rgba(255,255,255,.06)'}`,
      background: active ? `${s.dimColor}88` : 'rgba(255,255,255,.03)',
      boxShadow: active ? s.glow : 'none',
      transition: 'all .4s',
    }}>
      <p style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: active ? s.color : '#334155' }}>{count}</p>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginTop: 4, color: active ? s.color : '#475569' }}>{s.label}</p>
    </div>
  )
}

function PriCounter({ pri, count }) {
  const p = PRI[pri]
  const active = count > 0
  return (
    <div style={{
      textAlign: 'center', minWidth: 72, padding: '10px 12px', borderRadius: 10,
      border: `1px solid ${active ? p.border : 'rgba(255,255,255,.06)'}`,
      background: active ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)',
    }}>
      <p style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: active ? p.color : '#334155' }}>{count}</p>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', marginTop: 4, color: active ? p.color : '#475569' }}>{p.label}</p>
    </div>
  )
}

function HostChip({ host }) {
  const up = host.available
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10,
      border: `1px solid ${up ? 'rgba(74,222,128,.25)' : 'rgba(248,113,113,.35)'}`,
      background: up ? 'rgba(20,83,45,.35)' : 'rgba(127,29,29,.35)',
      boxShadow: up ? '' : '0 0 10px rgba(239,68,68,.15)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: up ? '#4ade80' : '#f87171',
        boxShadow: up ? '0 0 6px #4ade80' : '0 0 6px #f87171',
        animation: up ? 'none' : 'pulse 1.5s infinite',
      }} />
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.2 }}>{host.name}</p>
        {host.ip && <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>{host.ip}</p>}
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
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10,
      border: `1px solid ${s.border}`,
      background: `${s.dimColor}55`,
      boxShadow: p.severity >= 4 ? s.glow : 'none',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', padding: '3px 8px',
        borderRadius: 6, border: `1px solid ${s.border}`, color: s.color, flexShrink: 0,
        background: `${s.dimColor}99`,
      }}>{s.label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{p.hostName ?? p.hosts?.[0]?.host}</p>
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
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 9,
      border: `1px solid ${p.border}`, background: 'rgba(255,255,255,.03)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: p.color, flexShrink: 0 }}>#{t.id}</span>
      <p style={{ flex: 1, fontSize: 12.5, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name ?? t.title}</p>
      <span style={{ fontSize: 11, fontWeight: 600, color: p.color, flexShrink: 0 }}>{p.label}</span>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function TvDashboardPage() {
  const { play, muted } = useAlertSound()
  const [isMuted, setIsMuted] = useState(false)
  const toggleMute = () => { muted.current = !muted.current; setIsMuted(muted.current) }

  const { hosts, problems, tickets, lastUpdate, stale } = useDashboardData(useCallback(sev => play(sev), [play]))
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
    <div style={{ minHeight: '100vh', background: '#020817', color: '#e2e8f0', fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .tv-row { animation: fadein .3s ease }
      `}</style>

      {/* ── Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>N</div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#f1f5f9' }}>NexusIT Monitor</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 99,
            background: stale ? 'rgba(234,179,8,.12)' : 'rgba(74,222,128,.1)',
            color: stale ? '#fbbf24' : '#4ade80',
            border: `1px solid ${stale ? 'rgba(234,179,8,.25)' : 'rgba(74,222,128,.2)'}`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: stale ? '#fbbf24' : '#4ade80', animation: stale ? 'none' : 'pulse 2s infinite' }} />
            {stale ? `Atualizado ${lastUpdate?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : 'Ao vivo'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Uptime bar */}
          {hosts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>{online.length}/{hosts.length} hosts</span>
              <div style={{ width: 120, height: 6, borderRadius: 99, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctOnline}%`, background: pctOnline === 100 ? '#4ade80' : pctOnline >= 80 ? '#fbbf24' : '#f87171', borderRadius: 99, transition: 'width .6s' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: pctOnline === 100 ? '#4ade80' : pctOnline >= 80 ? '#fbbf24' : '#f87171' }}>{pctOnline}%</span>
            </div>
          )}

          <button onClick={toggleMute} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: isMuted ? '#475569' : '#94a3b8', fontSize: 16 }}>
            {isMuted ? '🔇' : '🔔'}
          </button>

          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1, color: hasCritical ? '#f87171' : '#f1f5f9' }}>
              {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 2, textTransform: 'capitalize' }}>
              {clock.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
        </div>
      </header>

      {/* ── Body: 3-column grid ── */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 420px', gap: 0, overflow: 'hidden' }}>

        {/* COL 1 — Hosts + Tickets */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,.06)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

          {/* Hosts */}
          <section>
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
          <section style={{ flex: 1 }}>
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
        <div style={{ borderRight: '1px solid rgba(255,255,255,.06)', padding: '20px 24px', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
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
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedProblems.map(p => <ProblemRow key={p.id ?? p.problemid} p={p} />)}
            </div>
          )}
        </div>

        {/* COL 3 — Severity counters + summary */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

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
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>{r.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: r.color, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#475569' }}>{children}</h2>
    </div>
  )
}

function Chip({ children }) {
  return <span style={{ fontSize: 11, color: '#334155', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{children}</span>
}

function EmptyState({ children }) {
  return <p style={{ fontSize: 13, color: '#334155', padding: '12px 0' }}>{children}</p>
}

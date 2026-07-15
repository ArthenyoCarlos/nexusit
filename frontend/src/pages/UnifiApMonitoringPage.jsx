import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { getUnifiApPanel } from '../services/monitoring'
import { analyzeMonitoredClients, buildApSummary, enrichAps, explainApLast24h, explainUnifiEvent, formatDuration, formatMs, formatRateKbps, normalizeMac, statusLabel } from '../utils/unifiApPanel'

const statusStyle = {
  healthy: { color: 'var(--green)', bg: 'var(--green-bg)', border: 'rgba(34,197,94,.32)' },
  warning: { color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'rgba(245,158,11,.35)' },
  down: { color: 'var(--red)', bg: 'var(--red-bg)', border: 'rgba(239,68,68,.35)' },
}

function formatClock(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Kpi({ label, value, tone = 'healthy', hint }) {
  const s = statusStyle[tone] ?? statusStyle.healthy
  return (
    <div className="stat-card" style={{ border: `1px solid ${s.border}` }}>
      <div className="stat-value" style={{ color: s.color }}>{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <p style={{ marginTop: 5, fontSize: 11.5, color: 'var(--text-tertiary)' }}>{hint}</p>}
    </div>
  )
}

function EventCard({ event, compact = false }) {
  const [open, setOpen] = useState(false)
  const info = explainUnifiEvent(event)
  const s = statusStyle[info.tone] ?? statusStyle.healthy
  return (
    <div style={{ border: `1px solid ${s.border}`, borderRadius: compact ? 10 : 12, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        style={{ width: '100%', border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: compact ? '8px 10px' : '10px 12px' }}
        title="Clique para ver explicação e orientação"
      >
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr auto' : '120px 150px 1fr auto', gap: 10, alignItems: 'baseline', fontSize: compact ? 11.5 : 12 }}>
          {!compact && <span style={{ color: 'var(--text-tertiary)' }}>{formatClock(event.time)}</span>}
          {!compact && <span style={{ color: event.apName ? 'var(--accent-text)' : 'var(--text-tertiary)', fontWeight: event.apName ? 700 : 500 }}>{event.apName || 'Controladora'}</span>}
          <span style={{ minWidth: 0 }}>
            <strong style={{ color: s.color, fontWeight: 800 }}>{info.title}</strong>
            <span style={{ color: 'var(--text-secondary)' }}> — {info.summary}</span>
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{open ? 'fechar' : 'detalhes'}</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: compact ? '0 10px 10px' : '0 12px 12px', borderTop: '1px solid var(--border-muted)', display: 'grid', gap: 8, fontSize: 12, lineHeight: 1.45 }}>
          <InfoLine label="Horário" value={formatClock(event.time)} />
          <InfoLine label="Tipo" value={info.severity === 'problem' ? 'Possível problema' : info.severity === 'warning' ? 'Atenção' : 'Informativo'} warn={info.severity !== 'info'} />
          <DetailText title="O que significa" text={info.meaning} />
          <DetailText title="Quando vira problema" text={info.whenProblem} />
          <DetailText title="Como resolver/verificar" text={info.action} />
          {(info.details ?? []).length > 0 && (
            <div>
              <p className="label-caps" style={{ marginBottom: 4 }}>Dados identificados</p>
              <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-secondary)' }}>
                {info.details.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--text-tertiary)' }}>Mensagem original da controladora</summary>
            <code style={{ display: 'block', marginTop: 6, whiteSpace: 'pre-wrap', color: 'var(--text-tertiary)' }}>{info.raw}</code>
          </details>
        </div>
      )}
    </div>
  )
}

function DetailText({ title, text }) {
  return (
    <div>
      <p className="label-caps" style={{ marginBottom: 3 }}>{title}</p>
      <p style={{ color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  )
}

function ApLast24hExplanation({ ap }) {
  const [open, setOpen] = useState(false)
  const info = explainApLast24h(ap)
  const s = statusStyle[info.tone] ?? statusStyle.healthy
  return (
    <div style={{ border: `1px solid ${s.border}`, borderRadius: 12, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', border: 'none', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: '10px 11px' }}
        title="Clique para entender os números das últimas 24h"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Últimas 24h</p>
            <p style={{ fontSize: 12.5, color: s.color, fontWeight: 800 }}>{info.title}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>{info.summary}</p>
          </div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11, flexShrink: 0 }}>{open ? 'fechar' : 'entender'}</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 11px 11px', borderTop: '1px solid var(--border-muted)', display: 'grid', gap: 8 }}>
          {info.details.map(item => (
            <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '84px 40px 1fr', gap: 8, alignItems: 'baseline', fontSize: 12 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{item.label}</span>
              <strong style={{ color: item.ok ? 'var(--green)' : 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{item.value}</strong>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>{item.explanation}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, padding: 9, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}>
            <p className="label-caps" style={{ marginBottom: 4 }}>O que fazer</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{info.action}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ClientMonitorSection({ payload }) {
  const storageKey = 'nexusit.unifi.monitoredClients.v1'
  const [devices, setDevices] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  })
  const [name, setName] = useState('')
  const [mac, setMac] = useState('')
  const [error, setError] = useState('')

  const saveDevices = next => {
    setDevices(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const addDevice = event => {
    event.preventDefault()
    const normalized = normalizeMac(mac)
    if (!normalized) {
      setError('Informe um MAC válido, exemplo: 54:47:41:ee:fd:0d')
      return
    }
    if (devices.some(device => normalizeMac(device.mac) === normalized)) {
      setError('Esse MAC já está na lista.')
      return
    }
    saveDevices([...devices, { id: `${normalized}-${Date.now()}`, name: name.trim() || `Dispositivo ${normalized.slice(-5)}`, mac: normalized }])
    setName('')
    setMac('')
    setError('')
  }

  const removeDevice = id => saveDevices(devices.filter(device => device.id !== id))
  const monitored = useMemo(
    () => analyzeMonitoredClients(devices, payload?.wirelessClients ?? [], payload?.recentControllerEvents ?? []),
    [devices, payload]
  )

  return (
    <section className="card" style={{ padding: 16, marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <p className="label-caps">Dispositivos monitorados</p>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>Coletores, celulares ou notebooks por MAC</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.45 }}>
            Use quando alguém reclamar que o sistema travou: cadastre o MAC e veja se o equipamento está online, em qual AP, sinal, SSID, roaming e desconexões recentes.
          </p>
        </div>
        <span className="badge" style={{ color: 'var(--accent-text)', border: '1px solid var(--border-muted)' }}>{payload?.wirelessClients?.length ?? 0} clientes ativos</span>
      </div>

      <form onSubmit={addDevice} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(180px, 1fr) auto', gap: 10, alignItems: 'end', marginBottom: 12 }}>
        <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
          Nome/apelido
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Coletor Rua 3" style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
          MAC do dispositivo
          <input value={mac} onChange={e => setMac(e.target.value)} placeholder="54:47:41:ee:fd:0d" style={inputStyle} />
        </label>
        <button type="submit" className="btn btn-primary" style={{ height: 38 }}>Monitorar</button>
      </form>
      {error && <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</p>}

      {monitored.length === 0 ? (
        <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-subtle)', border: '1px dashed var(--border-muted)', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Nenhum dispositivo cadastrado ainda. Pegue o MAC do coletor/celular e adicione acima.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
          {monitored.map(device => <ClientDeviceCard key={device.id} device={device} onRemove={() => removeDevice(device.id)} />)}
        </div>
      )}
    </section>
  )
}

const inputStyle = {
  height: 38,
  borderRadius: 10,
  border: '1px solid var(--border-muted)',
  background: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  padding: '0 11px',
  outline: 'none',
}

function ClientDeviceCard({ device, onRemove }) {
  const [open, setOpen] = useState(false)
  const s = statusStyle[device.tone] ?? statusStyle.healthy
  const active = device.active
  return (
    <div style={{ border: `1px solid ${s.border}`, borderRadius: 14, background: 'var(--bg-subtle)', padding: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{device.name}</p>
          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{device.mac}</p>
        </div>
        <button type="button" onClick={onRemove} style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>remover</button>
      </div>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 11, border: `1px solid ${s.border}`, background: s.bg }}>
        <p style={{ color: s.color, fontWeight: 800, fontSize: 13 }}>{device.title}</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.45, marginTop: 4 }}>{device.summary}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
        <InfoLine label="AP atual" value={active?.apName || active?.apMac || 'offline'} warn={!active} />
        <InfoLine label="Rede" value={active?.ssid || '—'} />
        <InfoLine label="IP" value={active?.ip || '—'} />
        <InfoLine label="Canal" value={active?.channel ?? '—'} />
        <InfoLine label="Sinal" value={device.signal.label} warn={device.signal.tone !== 'healthy'} />
        <InfoLine label="Conectado há" value={formatDuration(active?.uptimeSeconds)} />
        <InfoLine label="Roaming" value={`${device.roams} evento(s)`} warn={device.roams >= 5} />
        <InfoLine label="Desconexões" value={`${device.disconnects} evento(s)`} warn={device.disconnects > 0} />
      </div>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ marginTop: 10, width: '100%', border: '1px solid var(--border-muted)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>
        {open ? 'fechar diagnóstico' : 'entender diagnóstico'}
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'grid', gap: 9, fontSize: 12.5 }}>
          <DetailText title="Leitura operacional" text={device.signal.description} />
          <DetailText title="O que fazer" text={device.action} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <InfoLine label="TX" value={formatRateKbps(active?.txRate)} />
            <InfoLine label="RX" value={formatRateKbps(active?.rxRate)} />
            <InfoLine label="Ruído" value={active?.noise != null ? `${active.noise} dBm` : '—'} />
            <InfoLine label="Último visto" value={device.lastSeen ? formatClock(device.lastSeen) : '—'} />
          </div>
          {(device.relatedEvents ?? []).length > 0 && (
            <div>
              <p className="label-caps" style={{ marginBottom: 6 }}>Eventos desse dispositivo</p>
              <div style={{ display: 'grid', gap: 6 }}>
                {device.relatedEvents.slice(0, 4).map((event, index) => <EventCard key={`${event.time}-${index}`} event={event} compact />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ApCard({ ap }) {
  const s = statusStyle[ap.status] ?? statusStyle.healthy
  const portKnown = ap.switchPort && ap.switchPort !== 'unknown'
  return (
    <div className="card" style={{ padding: 16, border: `1px solid ${s.border}`, boxShadow: ap.status === 'down' ? '0 0 0 1px rgba(239,68,68,.15)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, boxShadow: `0 0 0 4px ${s.bg}` }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ap.name}</h3>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{ap.ip} · {ap.mac || 'MAC pendente'}</p>
        </div>
        <span className="badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}`, flexShrink: 0 }}>{statusLabel(ap.status)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
        <MiniMetric label="Perda agora" value={`${Number(ap.lastLossPct ?? 0).toFixed(0)}%`} tone={(ap.lastLossPct ?? 0) > 0 ? 'warning' : 'healthy'} />
        <MiniMetric label="Latência média" value={formatMs(ap.avgRttMs)} tone={(ap.avgRttMs ?? 0) > 50 ? 'warning' : 'healthy'} />
        <MiniMetric label="Uptime" value={formatDuration(ap.uptimeSeconds)} tone={(ap.reboots24h ?? 0) > 0 ? 'warning' : 'healthy'} />
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-muted)', display: 'grid', gap: 8 }}>
        <InfoLine label="Switch/porta" value={`${ap.switchName || 'Switch'} / ${portKnown ? ap.switchPort : 'porta pendente'}`} warn={!portKnown} />
        <ApLast24hExplanation ap={ap} />
        <InfoLine label="SNMP" value={ap.snmpOk ? 'OK — uptime real coletado' : 'Indisponível — verificar comunidade/permissão'} warn={!ap.snmpOk} />
        <InfoLine label="Atualizado" value={formatClock(ap.lastSeenTs)} />
      </div>

      {ap.mappingNote && (
        <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>{ap.mappingNote}</p>
      )}

      {(ap.recentControllerEvents ?? []).length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-muted)' }}>
          <p className="label-caps" style={{ marginBottom: 6 }}>Eventos controladora</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {ap.recentControllerEvents.slice(0, 3).map((event, index) => (
              <EventCard key={`${event.time}-${index}`} event={event} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniMetric({ label, value, tone }) {
  const s = statusStyle[tone] ?? statusStyle.healthy
  return (
    <div style={{ padding: '10px 9px', borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)', border: '1px solid var(--border-muted)' }}>
      <p style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</p>
      <p style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{value}</p>
    </div>
  )
}

function InfoLine({ label, value, warn = false }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: warn ? 'var(--amber)' : 'var(--text-secondary)', fontWeight: warn ? 700 : 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function UnifiApMonitoringPage() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await getUnifiApPanel()
      setPayload(res.data)
      setError('')
      setLastUpdate(new Date())
    } catch (e) {
      setError('Não foi possível carregar o painel de APs UniFi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 60_000)
    return () => clearInterval(timer)
  }, [fetchData])

  const aps = useMemo(() => enrichAps(payload?.aps ?? []), [payload])
  const summary = useMemo(() => buildApSummary(aps), [aps])
  const generatedAt = payload?.generatedAt ? new Date(payload.generatedAt * 1000) : null
  const stale = generatedAt ? Date.now() - generatedAt.getTime() > 5 * 60_000 : false

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Monitoramento de APs UniFi</h1>
            <p>Perda, latência, uptime, reboot e mapeamento AP → switch → porta</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-tertiary)', fontSize: 12.5 }}>
            <span>{lastUpdate ? `Atualizado ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Carregando'}</span>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: loading ? 'var(--amber)' : stale ? 'var(--red)' : 'var(--green)', display: 'inline-block' }} />
          </div>
        </div>

        {error && <div className="card" style={{ padding: 16, borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 22 }}>
          <Kpi label="APs monitorados" value={summary.total} hint="Coleta a cada 1 minuto" />
          <Kpi label="Saudáveis" value={summary.healthy} tone="healthy" />
          <Kpi label="Atenção" value={summary.warning} tone={summary.warning > 0 ? 'warning' : 'healthy'} />
          <Kpi label="Críticos" value={summary.down} tone={summary.down > 0 ? 'down' : 'healthy'} />
          <Kpi label="Perda média 24h" value={`${summary.avgLoss.toFixed(1)}%`} tone={summary.avgLoss > 0 ? 'warning' : 'healthy'} />
          <Kpi label="Maior latência" value={formatMs(summary.maxLatency)} tone={summary.maxLatency > 50 ? 'warning' : 'healthy'} />
          <Kpi label="Reboots 24h" value={summary.reboots24h} tone={summary.reboots24h > 0 ? 'warning' : 'healthy'} />
          <Kpi label="Eventos UniFi" value={summary.controllerEvents24h} hint="Clique nos eventos para entender" />
          <Kpi label="Porta pendente" value={summary.unmapped} tone={summary.unmapped > 0 ? 'warning' : 'healthy'} />
        </div>

        <section className="card" style={{ padding: 16, marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <InfoBlock title="Controladora" value={`${payload?.controller?.ip ?? '192.168.2.52'} · UniFi Network`} subtitle={payload?.controller?.url ?? 'https://192.168.2.52:8443'} />
            <InfoBlock title="Eventos" value={payload?.controller?.eventStatus === 'ok' ? 'Integrado' : 'Pendente'} subtitle={payload?.controller?.eventStatus === 'ok' ? 'Logs da controladora correlacionados por AP' : 'Verificar credencial da controladora'} warn={payload?.controller?.eventStatus !== 'ok'} />
            <InfoBlock title="Clientes Wi‑Fi" value={payload?.controller?.clientStatus === 'ok' ? `${payload?.wirelessClients?.length ?? 0} ativos` : 'Pendente'} subtitle={payload?.controller?.clientStatus === 'ok' ? 'MAC, AP, SSID, sinal, TX/RX e roaming' : 'Verificar leitura /stat/sta da controladora'} warn={payload?.controller?.clientStatus !== 'ok'} />
            <InfoBlock title="Snapshot" value={generatedAt ? generatedAt.toLocaleString('pt-BR') : 'Sem snapshot'} subtitle={stale ? 'Atenção: coleta aparentemente atrasada' : 'Coletor Hermes ativo'} warn={stale} />
            <InfoBlock title="Fonte" value="Hermes + SNMP + ICMP + LLDP" subtitle="Histórico SQLite e JSON consumido pelo NexusIT" />
          </div>
        </section>

        <ClientMonitorSection payload={payload} />

        {(payload?.recentControllerEvents ?? []).length > 0 && (
          <section className="card" style={{ padding: 16, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div>
                <p className="label-caps">Últimos eventos da controladora</p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>Eventos UniFi relevantes nas últimas {payload?.windowHours ?? 24}h</p>
              </div>
              <span className="badge badge-amber">{payload.recentControllerEvents.length}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {payload.recentControllerEvents.slice(0, 10).map((event, index) => (
                <EventCard key={`${event.time}-${index}`} event={event} />
              ))}
            </div>
          </section>
        )}

        {loading && aps.length === 0 ? (
          <div className="card empty-state"><h3>Carregando APs...</h3></div>
        ) : aps.length === 0 ? (
          <div className="card empty-state"><h3>Nenhum AP no snapshot</h3><p>Verifique o job Hermes UniFi AP loss/latency/uptime watchdog.</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
            {aps.map(ap => <ApCard key={ap.name} ap={ap} />)}
          </div>
        )}
      </div>
    </Layout>
  )
}

function InfoBlock({ title, value, subtitle, warn = false }) {
  return (
    <div style={{ padding: 14, borderRadius: 'var(--r-lg)', border: '1px solid var(--border-muted)', background: 'var(--bg-subtle)' }}>
      <p className="label-caps" style={{ marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: warn ? 'var(--amber)' : 'var(--text-primary)' }}>{value}</p>
      <p style={{ marginTop: 3, fontSize: 12, color: 'var(--text-tertiary)' }}>{subtitle}</p>
    </div>
  )
}

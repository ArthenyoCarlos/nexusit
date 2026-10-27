export function createSessionPoller({ load, onData, onError, onBusy = () => {}, schedule = setTimeout, cancel = clearTimeout }) {
  let stopped = false, busy = false, timer, controller
  async function refresh() {
    if (stopped || busy) return
    if (timer != null) cancel(timer)
    busy = true
    controller = new AbortController()
    onBusy(true)
    try {
      const response = await load({ signal: controller.signal, timeout: 20000 })
      if (!stopped) onData(response.data)
    } catch (error) {
      if (!stopped) onError(error)
    } finally {
      busy = false
      if (!stopped) { onBusy(false); timer = schedule(refresh, 30000) }
    }
  }
  return { refresh, stop() { stopped = true; if (timer != null) cancel(timer); controller?.abort() } }
}

export function filterSessions(sessions, query = '', state = '') {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const search = normalize(query.trim())
  return sessions.filter(session => (!state || session.state === state) && normalize(`${session.domain ?? ''} ${session.user ?? ''}`).includes(search))
}

export function paginateHistory(events, query = '', pageSize = 10, page = 1) {
  const size = [10, 25, 50, 100].includes(Number(pageSize)) ? Number(pageSize) : 10
  const filtered = filterSessions(events, query).sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
  const totalPages = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(totalPages, Math.max(1, Math.trunc(Number(page)) || 1))
  return { rows: filtered.slice((current - 1) * size, current * size), total: filtered.length, totalPages, page: current, pageSize: size }
}

export function formatDisconnectedDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'Desconhecido'
  const value = Math.floor(seconds)
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor(value % 3600 / 60)
  return [hours ? `${hours}h` : '', minutes ? `${minutes}min` : '', `${value % 60}s`].filter(Boolean).join(' ')
}

export function formatTsDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Recife' })
}

export function windowsEventLabel(event) {
  return ({ 21: 'Logon', 23: 'Logoff confirmado', 24: 'Desconexão', 25: 'Reconexão' })[event.eventId] ?? `Evento ${event.eventId ?? 'sem ID'} (não classificado)`
}

export function sessionCompliance(session, policy = {}) {
  if (session.isAdmin === true) return 'EXEMPT'
  if (session.isAdmin !== false) return 'UNKNOWN'
  if (session.state === 'ACTIVE') return 'ACTIVE'
  if (session.state !== 'DISCONNECTED') return 'UNKNOWN'
  const seconds = session.disconnectedSeconds
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'UNKNOWN'
  const limit = Number.isFinite(policy.disconnectLimitMinutes) && policy.disconnectLimitMinutes > 0 ? policy.disconnectLimitMinutes : 30
  const tolerance = Number.isFinite(policy.toleranceSeconds) && policy.toleranceSeconds >= 0 ? policy.toleranceSeconds : 120
  return seconds > limit * 60 + tolerance ? 'OVERDUE' : 'WITHIN_LIMIT'
}

// A proteção local de 120 s impede que um snapshot parado continue verde.
export function collectionHealth(data, error = '', now = Date.now()) {
  if (error) return { status: 'ERROR', label: 'Falha na atualização', color: 'var(--red)' }
  if (!data || data.status === 'UNAVAILABLE') return { status: 'UNAVAILABLE', label: 'Coleta indisponível', color: 'var(--text-tertiary)' }
  if (data.status === 'ERROR') return { status: 'ERROR', label: 'Erro na coleta', color: 'var(--red)' }
  if (data.stale || data.status === 'STALE') return { status: 'STALE', label: 'Dados desatualizados', color: 'var(--amber)' }
  const timestamp = data.collectedAt ? Date.parse(data.collectedAt) : NaN
  if (!Number.isFinite(timestamp) || data.status !== 'OK' || !Array.isArray(data.sessions)) return { status: 'UNAVAILABLE', label: 'Coleta não confirmada', color: 'var(--text-tertiary)' }
  const age = Math.max((now - timestamp) / 1000, Number(data.collectionAgeSeconds) || 0)
  if (age > 120) return { status: 'STALE', label: 'Dados desatualizados', color: 'var(--amber)' }
  return { status: 'OK', label: 'Coleta atualizada', color: 'var(--green)' }
}

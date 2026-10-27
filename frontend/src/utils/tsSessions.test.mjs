import test from 'node:test'
import assert from 'node:assert/strict'

const helpers = await import('./tsSessions.js')

test('conformidade usa desconexão real, tolerância e classificação administrativa conhecida', () => {
  assert.equal(typeof helpers.sessionCompliance, 'function')
  const session = { state: 'DISCONNECTED', isAdmin: false, disconnectedSeconds: 1920, idleSeconds: 99999 }
  assert.equal(helpers.sessionCompliance(session), 'WITHIN_LIMIT')
  assert.equal(helpers.sessionCompliance({ ...session, disconnectedSeconds: 1921 }), 'OVERDUE')
  assert.equal(helpers.sessionCompliance({ ...session, disconnectedSeconds: 1801 }), 'WITHIN_LIMIT')
  assert.equal(helpers.sessionCompliance({ ...session, isAdmin: true }), 'EXEMPT')
  assert.equal(helpers.sessionCompliance({ ...session, isAdmin: null, compliance: 'OVERDUE' }), 'UNKNOWN')
  assert.equal(helpers.sessionCompliance({ ...session, disconnectedSeconds: null }), 'UNKNOWN')
  assert.equal(helpers.sessionCompliance({ ...session, state: 'ACTIVE' }), 'ACTIVE')
  assert.equal(helpers.sessionCompliance({ ...session, state: 'ACTIVE', isAdmin: null }), 'UNKNOWN')
  assert.equal(helpers.sessionCompliance({ ...session, state: 'ACTIVE', isAdmin: true }), 'EXEMPT')
  assert.equal(helpers.sessionCompliance({ ...session, state: 'LISTEN' }), 'UNKNOWN')
  assert.equal(helpers.sessionCompliance({ ...session, disconnectedSeconds: -1 }), 'UNKNOWN')
})
test('apresentação preserva desconhecidos e filtra usuário e estado sem alterar sessões', () => {
  assert.equal(typeof helpers.filterSessions, 'function')
  const sessions = [{ user: 'João', domain: 'EMPRESA', state: 'ACTIVE' }, { user: 'Maria', state: 'DISCONNECTED' }]
  assert.deepEqual(helpers.filterSessions(sessions, 'joao', 'ACTIVE'), [sessions[0]])
  assert.deepEqual(helpers.filterSessions(sessions, 'empresa', ''), [sessions[0]])
  assert.deepEqual(helpers.filterSessions(sessions, 'Maria', 'ACTIVE'), [])
  assert.equal(helpers.formatDisconnectedDuration(null), 'Desconhecido')
  assert.equal(helpers.formatDisconnectedDuration(-1), 'Desconhecido')
  assert.equal(helpers.formatDisconnectedDuration(0), '0s')
  assert.equal(helpers.formatDisconnectedDuration(1921), '32min 1s')
  assert.equal(helpers.formatDisconnectedDuration(3661), '1h 1min 1s')
  assert.equal(helpers.formatTsDate(null), '—')
  assert.equal(helpers.formatTsDate('inválido'), '—')
  assert.match(helpers.formatTsDate('2026-10-27T15:00:00Z'), /27\/10\/2026.*12:00:00/)
  assert.equal(helpers.windowsEventLabel({ eventId: 23 }), 'Logoff confirmado')
  assert.equal(helpers.windowsEventLabel({ eventId: 24 }), 'Desconexão')
  assert.equal(helpers.windowsEventLabel({ eventId: '25' }), 'Reconexão')
  assert.equal(helpers.windowsEventLabel({ eventId: 21 }), 'Logon')
  assert.equal(helpers.windowsEventLabel({ eventId: 99, type: 'LOGOFF' }), 'Evento 99 (não classificado)')
})

test('polling evita sobreposição, agenda 30s e cancela sem publicar após desmontagem', async () => {
  assert.equal(typeof helpers.createSessionPoller, 'function')
  let calls = 0, resolve, signal, scheduled, cancelled = false
  const received = []
  const poller = helpers.createSessionPoller({
    load: options => { calls++; signal = options.signal; return new Promise(done => { resolve = done }) },
    onData: data => received.push(data), onError: () => assert.fail('não deveria falhar'),
    schedule: (fn, delay) => { scheduled = { fn, delay }; return 7 },
    cancel: id => { assert.equal(id, 7); cancelled = true },
  })
  const first = poller.refresh()
  await poller.refresh()
  assert.equal(calls, 1)
  resolve({ data: { sessions: [] } })
  await first
  assert.deepEqual(received, [{ sessions: [] }])
  assert.equal(scheduled.delay, 30000)
  const next = scheduled.fn()
  assert.equal(calls, 2)
  poller.stop()
  assert.equal(signal.aborted, true)
  assert.equal(cancelled, true)
  resolve({ data: { sessions: ['late'] } })
  await next
  assert.equal(received.length, 1)
})

test('saúde não converte coleta ausente, falha ou vencida em painel saudável', () => {
  assert.equal(typeof helpers.collectionHealth, 'function')
  const now = Date.parse('2026-10-27T15:00:00Z')
  assert.equal(helpers.collectionHealth(null, '', now).status, 'UNAVAILABLE')
  const fresh = { status: 'OK', stale: false, collectedAt: '2026-10-27T14:59:40Z', sessions: [] }
  assert.equal(helpers.collectionHealth({ ...fresh, sessions: null }, '', now).status, 'UNAVAILABLE')
  assert.equal(helpers.collectionHealth(fresh, '', now).status, 'OK')
  assert.equal(helpers.collectionHealth(fresh, 'Falha HTTP', now).status, 'ERROR')
  assert.equal(helpers.collectionHealth({ ...fresh, stale: true }, '', now).status, 'STALE')
  assert.equal(helpers.collectionHealth({ ...fresh, collectedAt: '2026-10-27T14:50:00Z' }, '', now).status, 'STALE')
  assert.equal(helpers.collectionHealth({ status: 'OK' }, '', now).status, 'UNAVAILABLE')
})

import assert from 'node:assert/strict'
import { buildApSummary, classifyAp, enrichAps, explainApLast24h, explainUnifiEvent, formatDuration, statusLabel } from './unifiApPanel.js'

assert.equal(formatDuration(65), '1m')
assert.equal(formatDuration(3660), '1h 1m')
assert.equal(formatDuration(90000), '1d 1h')

assert.equal(classifyAp({ lastLossPct: 0, avgRttMs: 4, snmpOk: true }), 'healthy')
assert.equal(classifyAp({ lastLossPct: 20, avgRttMs: 4, snmpOk: true }), 'warning')
assert.equal(classifyAp({ lastLossPct: 0, avgRttMs: 70, snmpOk: true }), 'warning')
assert.equal(classifyAp({ lastLossPct: 0, avgRttMs: 4, snmpOk: true, reboots24h: 1 }), 'warning')
assert.equal(classifyAp({ alertState: 'problem', lastLossPct: 100 }), 'down')
assert.equal(statusLabel('warning'), 'Atenção')

const aps = [
  { name: 'RUA 3', lastLossPct: 0, avgLossPct: 0, avgRttMs: 3, maxRttMs: 9, snmpOk: true, switchPort: 'Port 24' },
  { name: 'ADM', lastLossPct: 100, avgLossPct: 20, avgRttMs: null, maxRttMs: 0, snmpOk: false, switchPort: 'unknown' },
  { name: 'CAMARA', lastLossPct: 0, avgLossPct: 0, avgRttMs: 60, maxRttMs: 90, snmpOk: true, switchPort: 'Port 1', reboots24h: 1, controllerEvents24h: 2 },
]
const summary = buildApSummary(aps)
assert.equal(summary.total, 3)
assert.equal(summary.healthy, 1)
assert.equal(summary.warning, 1)
assert.equal(summary.down, 1)
assert.equal(summary.unmapped, 1)
assert.equal(summary.reboots24h, 1)
assert.equal(summary.controllerEvents24h, 2)
assert.equal(summary.maxLatency, 90)
assert.deepEqual(enrichAps(aps).map(ap => ap.name), ['ADM', 'CAMARA', 'RUA 3'])

const login = explainUnifiEvent({ message: 'Admin[admin] log in from 192.168.2.210' })
assert.equal(login.title, 'Login na controladora')
assert.match(login.summary, /admin.*192\.168\.2\.210/)
assert.equal(login.tone, 'healthy')

const clientConnect = explainUnifiEvent({
  message: 'User[3a:46:d6:35:89:64] has connected to AP[9c:05:d6:f2:5a:5b] with SSID "LOGISTICA" on "channel 40(na)"',
  apName: 'RUA 3 NOVO',
})
assert.equal(clientConnect.title, 'Cliente entrou no Wi‑Fi')
assert.match(clientConnect.summary, /LOGISTICA/)
assert.match(clientConnect.summary, /RUA 3 NOVO/)
assert.equal(clientConnect.tone, 'healthy')
assert.ok(clientConnect.details.some(item => item.includes('3a:46:d6:35:89:64')))

const clientRoam = explainUnifiEvent({
  message: 'User[0e:87:f8:27:a3:80] roams from AP[9c:05:d6:f2:57:97] to AP[9c:05:d6:f3:93:46] from "channel 40(na)" to "channel 44(na)" on "LOGISTICA"',
  fromApName: 'RUA 3 NOVO',
  toApName: 'RUA 7 NOVO',
})
assert.equal(clientRoam.title, 'Cliente trocou de AP')
assert.match(clientRoam.summary, /RUA 3 NOVO.*RUA 7 NOVO.*LOGISTICA/)
assert.equal(clientRoam.tone, 'healthy')
assert.ok(clientRoam.details.some(item => item.includes('0e:87:f8:27:a3:80')))
assert.ok(clientRoam.details.some(item => item.includes('Canal destino: 44')))

const last24h = explainApLast24h({ samples24h: 35, downSamples24h: 0, lossSamples24h: 0, reboots24h: 1, controllerEvents24h: 19 })
assert.equal(last24h.title, 'AP reiniciou nas últimas 24h')
assert.equal(last24h.tone, 'warning')
assert.match(last24h.summary, /reiniciou 1 vez/)
assert.ok(last24h.details.some(item => item.label === 'Eventos' && item.value === '19'))
assert.match(last24h.action, /PoE|energia/)

console.log('unifiApPanel tests passed')

import test from 'node:test'
import assert from 'node:assert/strict'
import * as helpers from './tsSessions.js'

test('histórico filtra usuário sem acentos e pagina sem alterar eventos originais', () => {
  assert.equal(typeof helpers.paginateHistory, 'function')
  const events = Array.from({ length: 31 }, (_, i) => ({ id: i, user: i < 26 ? 'TS\\Gênilson' : 'Wilson', at: new Date(1700000000000 + i * 1000).toISOString() }))
  const result = helpers.paginateHistory(events, ' genilson ', 10, 2)
  assert.equal(result.total, 26)
  assert.equal(result.totalPages, 3)
  assert.equal(result.page, 2)
  assert.equal(result.rows.length, 10)
  assert.equal(result.rows[0].id, 15)
  assert.equal(events[0].id, 0)
})

test('histórico limita páginas após atualização, trata vazio e tamanho inválido', () => {
  assert.equal(typeof helpers.paginateHistory, 'function')
  const events = [{ id: 1, user: 'Wilson', at: '2026-10-27T10:00:00Z' }]
  const result = helpers.paginateHistory(events, '', 999, 9)
  assert.equal(result.pageSize, 10)
  assert.equal(result.page, 1)
  const empty = helpers.paginateHistory(events, 'ausente', 25, 3)
  assert.equal(empty.total, 0)
  assert.equal(empty.page, 1)
  assert.deepEqual(empty.rows, [])
})

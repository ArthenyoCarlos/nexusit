import test from 'node:test'
import assert from 'node:assert/strict'
import * as helpers from './tsSessions.js'

test('atualizar solicita coleta e espera conclusão antes de ler snapshot', async () => {
 assert.equal(typeof helpers.collectFreshTsSnapshot,'function')
 const calls=[];let n=0
 const data=await helpers.collectFreshTsSnapshot({request:async()=>{calls.push('request');return {data:{id:'abc',status:'QUEUED'}}},status:async()=>{calls.push('status');return {data:{status:++n===1?'RUNNING':'SUCCEEDED'}}},load:async()=>{calls.push('snapshot');return {data:{status:'OK',collectedAt:'new'}}},pause:async()=>{}})
 assert.equal(data.collectedAt,'new');assert.deepEqual(calls,['request','status','status','snapshot'])
})
test('falha de coleta não aceita snapshot antigo como sucesso',async()=>{
 assert.equal(typeof helpers.collectFreshTsSnapshot,'function')
 await assert.rejects(helpers.collectFreshTsSnapshot({request:async()=>({data:{id:'abc'}}),status:async()=>({data:{status:'FAILED'}}),load:async()=>assert.fail('must not load')}),/coleta/i)
})

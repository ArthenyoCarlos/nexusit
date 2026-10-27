import test from 'node:test'
import assert from 'node:assert/strict'
import { readCandidate, shouldMarkRead, validateAttachment, validateAudioCaption, uploadError, CRM_UPLOAD_TIMEOUT_MS } from './supportCrm.js'
test('upload aguarda conversão e ACK antes do limite do proxy externo', () => {
 assert.equal(CRM_UPLOAD_TIMEOUT_MS, 360000)
})
test('áudio sem legenda é enviado separado do texto para evitar falhas parciais', () => {
 assert.match(validateAudioCaption('texto', {type:'audio/webm'}), /separadamente/)
 assert.equal(validateAudioCaption('', {type:'audio/webm'}), null)
 assert.equal(validateAudioCaption('texto', {type:'image/png'}), null)
})
test('limites em MB sem rejeitar duração e erros acionáveis', () => {
 assert.equal(validateAttachment({size:20*1024*1024,type:'audio/webm'}),null)
 assert.match(validateAttachment({size:33*1024*1024}),/32 MB/)
 assert.match(uploadError({response:{status:413}}),/32 MB/)
 assert.match(uploadError({response:{status:504}}),/confira o histórico/)
 assert.match(uploadError({response:{data:{detail:'Áudio inválido; nada foi enviado'}}}),/nada foi enviado/)
 assert.match(uploadError({response:{data:{message:'Falha na conversão'}}}),/conversão/)
})
test('marca somente última entrada exibida em conversa visível no fim', () => {
 const messages = [{id:1,author:'EMPLOYEE'}, {id:2,author:'TECH'}]
 assert.equal(readCandidate(messages),1)
 const base = {visible:true, nearBottom:true, open:true, candidate:1, now:1000}
 assert.equal(shouldMarkRead(base),true)
 for (const flag of ['visible','nearBottom','open']) assert.equal(shouldMarkRead({...base,[flag]:false}),false)
 assert.equal(shouldMarkRead({...base,previous:{id:1,remoteRead:'CONFIRMED'}}),false)
 assert.equal(shouldMarkRead({...base,previous:{id:1,remoteRead:'PENDING',retryAt:2000}}),false)
 assert.equal(shouldMarkRead({...base,now:2001,previous:{id:1,remoteRead:'PENDING',retryAt:2000}}),true)
 assert.equal(shouldMarkRead({...base,previous:{id:1,remoteRead:'UNAVAILABLE'}}),false)
})

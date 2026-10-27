export const CRM_UPLOAD_TIMEOUT_MS = 360000

export function validateAudioCaption(message, file) {
  return file?.type?.startsWith('audio/') && message?.trim() ? 'Envie o texto e o áudio separadamente. Envie primeiro uma mensagem de texto ou limpe o campo para enviar somente o áudio. Nada foi enviado.' : null
}
export function validateAttachment(file) {
  return file?.size > 32 * 1024 * 1024 ? 'Arquivo acima de 32 MB. Áudio convertido deve ter até 16 MB.' : null
}
export function uploadError(error) {
  if (error.response?.status === 413) return 'Arquivo muito grande: entrada até 32 MB; áudio convertido até 16 MB.'
  if (error.code === 'ECONNABORTED' || [502, 504].includes(error.response?.status)) return 'O serviço demorou a responder. Antes de reenviar, confira o histórico para evitar duplicidade. Seu rascunho foi preservado.'
  return error.response?.data?.detail || error.response?.data?.message || 'Falha no envio ou na conversão do áudio. Seu rascunho foi preservado; tente novamente manualmente.'
}
export function readCandidate(messages = []) {
  return messages.filter(m => m.author === 'EMPLOYEE').at(-1)?.id ?? null
}
export function shouldMarkRead({ visible, nearBottom, open, candidate, previous, now = Date.now() }) {
  if (!visible || !nearBottom || !open || !candidate || previous?.inFlight) return false
  if (previous?.id !== candidate) return true
  return previous.remoteRead === 'PENDING' && now >= previous.retryAt
}

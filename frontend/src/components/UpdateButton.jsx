import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import { useAuth } from '../contexts/AuthContext'
import { getUpdateStatus, applyUpdate } from '../services/updates'

export default function UpdateButton() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [status, setStatus] = useState(null)
  const [open, setOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) return
    const fetch = () => getUpdateStatus().then(setStatus).catch(() => {})
    fetch()
    const interval = setInterval(fetch, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isAdmin])

  useEffect(() => {
    if (!status?.updating) { clearInterval(pollRef.current); return }
    pollRef.current = setInterval(() => {
      getUpdateStatus().then(setStatus).catch(() => {})
    }, 15000)
    return () => clearInterval(pollRef.current)
  }, [status?.updating])

  if (!isAdmin || !status?.available || (!status.updateAvailable && !status.updating)) return null

  async function handleApply() {
    setApplying(true)
    try {
      const next = await applyUpdate()
      setStatus(next)
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 34, padding: '0 12px', borderRadius: 'var(--r-md)', flexShrink: 0,
          border: '1px solid var(--green)', background: 'var(--green-bg)',
          color: 'var(--green)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" />
        </svg>
        {status.updating ? 'Atualizando...' : 'Atualização disponível'}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Atualização do NexusIT" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {status.updating ? (
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Atualização em andamento — o sistema pode reiniciar sozinho em alguns minutos. Pode fechar esta janela, ela vai avisar de novo quando terminar.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>O que mudou nesta atualização:</p>
              <div style={{ background: 'var(--bg-muted)', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto', lineHeight: 1.6 }}>
                {status.changelog || 'Sem detalhes disponíveis para esta atualização.'}
              </div>
              {status.lastError && (
                <p style={{ fontSize: 12.5, color: 'var(--red)' }}>Última tentativa falhou: {status.lastError}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setOpen(false)} className="btn btn-default">Agora não</button>
                <button onClick={handleApply} disabled={applying} className="btn btn-primary">
                  {applying ? 'Iniciando...' : 'Atualizar agora'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}

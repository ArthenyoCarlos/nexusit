import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import jsQR from 'jsqr'

/** Scanner de QR code via câmera (getUserMedia + jsQR), sem plugin nativo. */
export default function QrScannerModal({ open, onClose, onResult }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setError('')

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          rafRef.current = requestAnimationFrame(tick)
        }
      })
      .catch(() => setError('Não foi possível acessar a câmera. Verifique a permissão.'))

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code?.data) {
        onResult(code.data)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [open, onResult])

  if (!open) return null

  return createPortal(
    <div
      className="fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Escanear QR do cartucho</span>
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: 'var(--r-sm)',
            border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)',
            color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1,
          }}
        >×</button>
      </div>

      <div style={{ width: '100%', maxWidth: 420, borderRadius: 'var(--r-xl)', overflow: 'hidden', position: 'relative', background: '#000' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block' }} />
        <div style={{
          position: 'absolute', inset: '15%', border: '3px solid rgba(255,255,255,0.7)',
          borderRadius: 12, pointerEvents: 'none',
        }} />
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {error && (
        <div className="alert alert-red" style={{ marginTop: 14, maxWidth: 420 }}>
          <p>{error}</p>
        </div>
      )}
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 14, textAlign: 'center' }}>
        Aponte a câmera para o QR code da etiqueta do cartucho.
      </p>
    </div>,
    document.body
  )
}

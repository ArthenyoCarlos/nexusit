import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const CLOSE_REASONS = {
  4000: 'ID de máquina inválido.',
  4003: 'Acesso negado.',
  4004: 'Máquina não encontrada.',
  4005: 'Erro ao ler as credenciais salvas.',
  4006: 'A chave do host mudou desde o último acesso — pode ser uma reinstalação legítima ou um ataque. Use "Resetar chave do host" no cadastro da máquina se você confirmou que a mudança é esperada.',
  4007: 'Falha ao conectar via SSH (host inacessível, porta errada ou credenciais inválidas).',
}

export default function SshTerminal({ hostId, hostName, onClose }) {
  const containerRef = useRef(null)
  const termRef       = useRef(null)
  const fitRef        = useRef(null)
  const wsRef         = useRef(null)
  const [status, setStatus] = useState('connecting')

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'var(--font-mono, monospace)',
      theme: { background: '#0d1117' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const token = localStorage.getItem('token')
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/ssh/${hostId}?token=${encodeURIComponent(token ?? '')}`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
    ws.onmessage = (event) => term.write(event.data)
    ws.onerror = () => setStatus('error')
    ws.onclose = (event) => {
      setStatus('closed')
      const reason = CLOSE_REASONS[event.code]
      if (reason) term.write(`\r\n\x1b[31m${reason}\x1b[0m\r\n`)
      else if (event.code !== 1000) term.write(`\r\n\x1b[31mConexão encerrada (código ${event.code}).\x1b[0m\r\n`)
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }))
    })

    const onResize = () => {
      fit.fit()
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
    window.addEventListener('resize', onResize)
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(containerRef.current)

    return () => {
      window.removeEventListener('resize', onResize)
      resizeObserver.disconnect()
      ws.close()
      term.dispose()
    }
  }, [hostId])

  const statusColor = { connecting: 'var(--amber)', connected: 'var(--green)', error: 'var(--red)', closed: 'var(--text-tertiary)' }[status]
  const statusLabel = { connecting: 'Conectando...', connected: 'Conectado', error: 'Erro de conexão', closed: 'Desconectado' }[status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#161b22', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: '#c9d1d9', fontFamily: 'var(--font-mono)' }}>{hostName} — {statusLabel}</span>
        </div>
        {onClose && <button onClick={onClose} className="btn btn-default btn-sm">Fechar</button>}
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, background: '#0d1117', padding: 8 }} />
    </div>
  )
}

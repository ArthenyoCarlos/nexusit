import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getQueue, getMine, getConversation, getMessageMediaBlob, claimConversation, replyToConversation, closeConversation } from '../services/support'

const STATE_LABEL = {
  AWAITING_NAME: 'Identificando', MENU: 'No menu', AWAITING_DESCRIPTION: 'Descrevendo problema',
  PENDING_TECH: 'Aguardando técnico', HUMAN_ACTIVE: 'Em atendimento', CLOSED: 'Encerrado',
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  return `${Math.floor(diff / 3600)}h atrás`
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function MediaAttachment({ message }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const mime = message.mediaMime || ''
  const kind = message.mediaKind || ''

  useEffect(() => {
    let revoked = false
    let objectUrl = null
    if (!message.mediaUrl) return undefined
    setError(false)
    getMessageMediaBlob(message.id)
      .then(blob => {
        if (revoked) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setError(true))
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [message.id, message.mediaUrl])

  if (!message.mediaUrl) return null
  if (error) return <p style={{ fontSize: 12, color: 'var(--danger)' }}>Não foi possível carregar a mídia.</p>
  if (!url) return <div className="skeleton" style={{ height: 90, borderRadius: 10, marginTop: 6 }} />

  const label = message.mediaFilename || 'anexo'
  const isImage = kind === 'image' || kind === 'sticker' || mime.startsWith('image/')
  const isVideo = kind === 'video' || mime.startsWith('video/')
  const isAudio = kind === 'audio' || mime.startsWith('audio/')
  const boxStyle = { marginTop: 8, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-muted)', background: 'rgba(0,0,0,.08)' }
  const actionStyle = { display: 'flex', gap: 10, alignItems: 'center', padding: '6px 8px', fontSize: 11.5, color: 'inherit', opacity: 0.85, flexWrap: 'wrap' }
  const linkStyle = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', background: 'none', border: 0, padding: 0, font: 'inherit' }

  const preview = previewOpen && (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setPreviewOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
      }}
    >
      <button
        type="button"
        onClick={() => setPreviewOpen(false)}
        className="btn btn-secondary btn-sm"
        style={{ position: 'absolute', top: 16, right: 16 }}
      >
        Fechar
      </button>
      {isImage ? (
        <img
          src={url}
          alt={label}
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '96vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 12 }}
        />
      ) : isVideo ? (
        <video
          src={url}
          controls
          autoPlay
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '96vw', maxHeight: '92vh', borderRadius: 12 }}
        />
      ) : null}
    </div>
  )

  if (isImage) {
    return (
      <>
        <div style={boxStyle}>
          <button type="button" onClick={() => setPreviewOpen(true)} title="Abrir imagem" style={{ display: 'block', width: '100%', border: 0, padding: 0, cursor: 'zoom-in', background: 'transparent' }}>
            <img src={url} alt={label} style={{ display: 'block', maxWidth: 320, maxHeight: 300, width: '100%', objectFit: 'contain', background: 'rgba(255,255,255,.04)' }} />
          </button>
          <div style={actionStyle}>
            <span>{kind === 'sticker' ? 'Figurinha' : 'Imagem'} · {label}</span>
            <button type="button" onClick={() => setPreviewOpen(true)} style={linkStyle}>Abrir</button>
            <a href={url} download={label} style={linkStyle}>Baixar</a>
          </div>
        </div>
        {preview}
      </>
    )
  }

  if (isVideo) {
    return (
      <>
        <div style={{ ...boxStyle, padding: 8 }}>
          <video src={url} controls style={{ display: 'block', maxWidth: 420, width: '100%', borderRadius: 8 }} />
          <div style={{ ...actionStyle, paddingLeft: 0, paddingRight: 0 }}>
            <span>Vídeo · {label}</span>
            <button type="button" onClick={() => setPreviewOpen(true)} style={linkStyle}>Abrir</button>
            <a href={url} download={label} style={linkStyle}>Baixar</a>
          </div>
        </div>
        {preview}
      </>
    )
  }

  if (isAudio) {
    return (
      <div style={{ ...boxStyle, padding: 8 }}>
        <audio src={url} controls style={{ display: 'block', width: '100%' }} />
        <div style={{ ...actionStyle, paddingLeft: 0, paddingRight: 0 }}>
          <span>Áudio · {label}</span>
          <a href={url} download={label} style={linkStyle}>Baixar</a>
        </div>
        {message.transcription && (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,.06)' }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, opacity: 0.7 }}>Transcrição</p>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{message.transcription}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ ...boxStyle, padding: 8 }}>
      <a href={url} download={label} style={{ fontSize: 12.5, color: 'inherit' }}>📎 Baixar anexo · {label}</a>
    </div>
  )
}

export default function SupportCrmPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [queue, setQueue] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [claimingId, setClaimingId] = useState(null)
  const [message, setMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [recording, setRecording] = useState(false)
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const threadEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const loadLists = useCallback(async () => {
    const [q, m] = await Promise.all([getQueue(), getMine()])
    setQueue(q); setMine(m)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLists()
    const t = setInterval(loadLists, 4000)
    return () => clearInterval(t)
  }, [loadLists])

  const loadDetail = useCallback(async (id) => {
    if (!id) { setDetail(null); return }
    try { setDetail(await getConversation(id)) } catch { setDetail(null) }
  }, [])

  useEffect(() => { loadDetail(selectedId) }, [selectedId, loadDetail])

  useEffect(() => {
    if (!selectedId) return
    const t = setInterval(() => loadDetail(selectedId), 3000)
    return () => clearInterval(t)
  }, [selectedId, loadDetail])

  useEffect(() => { threadEndRef.current?.scrollIntoView({ block: 'nearest' }) }, [detail])

  const handleClaim = async (id) => {
    setClaimingId(id)
    try {
      await claimConversation(id)
      toast.add('Atendimento assumido!', 'success')
      setSelectedId(id)
      loadLists()
    } catch (e) {
      if (e.response?.status === 409) toast.add('Este atendimento já foi assumido por outro técnico.', 'warning')
      else toast.add('Não foi possível assumir o atendimento.', 'error')
      loadLists()
    } finally { setClaimingId(null) }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if ((!message.trim() && !selectedFile) || !selectedId) return
    setSending(true)
    try {
      setDetail(await replyToConversation(selectedId, message.trim(), selectedFile))
      setMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally { setSending(false) }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data?.size) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        const type = recorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type })
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm'
        setSelectedFile(new File([blob], `audio-tecnico-${Date.now()}.${ext}`, { type }))
        setRecording(false)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      toast.add('Não foi possível acessar o microfone neste navegador.', 'error')
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else setRecording(false)
  }

  const handleClose = async () => {
    if (!selectedId) return
    setClosing(true)
    try {
      await closeConversation(selectedId)
      toast.add('Chamado encerrado.', 'success')
      loadLists(); loadDetail(selectedId)
    } finally { setClosing(false) }
  }

  const conversation = detail?.conversation
  const isMine = conversation?.claimedByName === user?.name && conversation?.state === 'HUMAN_ACTIVE'

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>CRM de Suporte</h1>
            <p>Atendimentos iniciados pelo Hermes via WhatsApp</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

          {/* Lists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <p className="label-caps" style={{ margin: 0 }}>Fila</p>
                {queue.length > 0 && <span className="badge badge-amber" style={{ fontSize: 10.5 }}>{queue.length}</span>}
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 72, borderRadius: 10 }} />
              ) : queue.length === 0 ? (
                <div className="card empty-state" style={{ padding: '16px 14px' }}><p style={{ fontSize: 12.5 }}>Nenhum atendimento aguardando</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {queue.map(c => (
                    <div key={c.id} className="card" style={{ padding: '12px 14px' }}>
                      <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{c.contactName || c.contactPhone}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {c.glpiTicketId ? `Chamado #${c.glpiTicketId}` : '—'} · {timeAgo(c.createdAt)}
                      </p>
                      <button onClick={() => handleClaim(c.id)} disabled={claimingId === c.id} className="btn btn-primary btn-sm" style={{ marginTop: 8, width: '100%' }}>
                        {claimingId === c.id ? 'Assumindo...' : 'Atender'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="label-caps" style={{ marginBottom: 8 }}>Meus atendimentos</p>
              {mine.length === 0 ? (
                <div className="card empty-state" style={{ padding: '16px 14px' }}><p style={{ fontSize: 12.5 }}>Nenhum atendimento em andamento</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mine.map(c => (
                    <button key={c.id} onClick={() => setSelectedId(c.id)}
                      className="card card-hover" style={{ padding: '12px 14px', textAlign: 'left', width: '100%', cursor: 'pointer',
                        border: selectedId === c.id ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                      <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{c.contactName || c.contactPhone}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {c.glpiTicketId ? `Chamado #${c.glpiTicketId}` : '—'} · {timeAgo(c.claimedAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Thread */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '75vh' }}>
            {!conversation ? (
              <div className="empty-state" style={{ margin: 'auto' }}><h3>Selecione um atendimento</h3><p>Escolha um item na fila ou em "Meus atendimentos".</p></div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-muted)' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text-primary)' }}>{conversation.contactName || conversation.contactPhone}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {conversation.contactPhone} · {conversation.glpiTicketId ? `Chamado #${conversation.glpiTicketId}` : 'sem chamado'} · {STATE_LABEL[conversation.state] ?? conversation.state}
                    </p>
                  </div>
                  {conversation.state === 'HUMAN_ACTIVE' && (
                    <button onClick={handleClose} disabled={closing} className="btn btn-danger btn-sm">{closing ? 'Fechando...' : 'Fechar chamado'}</button>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detail.messages.map(m => {
                    const mine = m.author === 'TECH'
                    const system = m.author === 'HERMES'
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '75%', padding: '8px 12px', borderRadius: 'var(--r-lg)',
                          background: mine ? 'var(--accent)' : system ? 'var(--bg-muted)' : 'var(--bg-subtle)',
                          color: mine ? 'var(--text-inverse)' : 'var(--text-primary)',
                        }}>
                          {!mine && <p style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>{m.authorName}</p>}
                          {m.content && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.content}</p>}
                          <MediaAttachment message={m} />
                        </div>
                      </div>
                    )
                  })}
                  <div ref={threadEndRef} />
                </div>

                <form onSubmit={handleSend} style={{ padding: '12px 18px', borderTop: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedFile && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-muted)', border: '1px solid var(--border-muted)' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>📎 {selectedFile.name} · {formatBytes(selectedFile.size)}</span>
                      <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="btn btn-default btn-sm">Remover</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      disabled={!isMine}
                      placeholder={isMine ? 'Escreva uma resposta ou anexe algo...' : conversation.state === 'HUMAN_ACTIVE' ? 'Atendido por outro técnico' : 'Atendimento não está ativo'}
                      className="input" style={{ flex: 1 }}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
                      disabled={!isMine || sending || recording}
                      onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                      style={{ display: 'none' }}
                    />
                    <button type="button" disabled={!isMine || sending || recording} onClick={() => fileInputRef.current?.click()} className="btn btn-default">Anexar</button>
                    {recording ? (
                      <button type="button" onClick={stopRecording} className="btn btn-danger">Parar áudio</button>
                    ) : (
                      <button type="button" disabled={!isMine || sending || selectedFile} onClick={startRecording} className="btn btn-default">Gravar áudio</button>
                    )}
                    <button type="submit" disabled={!isMine || sending || recording || (!message.trim() && !selectedFile)} className="btn btn-primary">{sending ? 'Enviando...' : 'Enviar'}</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

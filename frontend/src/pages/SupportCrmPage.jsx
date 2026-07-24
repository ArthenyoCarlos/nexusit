import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { VoiceRecorder } from '@independo/capacitor-voice-recorder'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getQueue, getMine, getConversation, getMessageMediaBlob, claimConversation, replyToConversation, closeConversation, addTechnician, removeTechnician, transferConversation } from '../services/support'
import { getTicket, updateTicketFields, getCategories, createCategory } from '../services/glpi'
import { getUsers } from '../services/users'
import { playAlertSound } from '../utils/alertSound'

function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
}

const STATE_LABEL = {
  AWAITING_NAME: 'Identificando', MENU: 'No menu', AWAITING_DESCRIPTION: 'Descrevendo problema',
  PENDING_TECH: 'Aguardando técnico', HUMAN_ACTIVE: 'Em atendimento', CLOSED: 'Encerrado',
}

const PRIORITY_OPTIONS = [
  { value: '6', label: 'Crítica' },
  { value: '5', label: 'Muito Alta' },
  { value: '4', label: 'Alta' },
  { value: '3', label: 'Média' },
  { value: '2', label: 'Baixa' },
  { value: '1', label: 'Muito Baixa' },
]
const URGENCY_IMPACT_OPTIONS = [
  { value: '5', label: 'Muito Alta' },
  { value: '4', label: 'Alta' },
  { value: '3', label: 'Média' },
  { value: '2', label: 'Baixa' },
  { value: '1', label: 'Muito Baixa' },
]

function splitLockedTitlePrefix(title = '') {
  const match = String(title || '').trim().match(/^\[(Zabbix|WhatsApp|Whatsapp|GLPI)]\s*(.*)$/i)
  if (match) {
    const raw = match[1].toLowerCase()
    const prefix = raw === 'zabbix' ? '[Zabbix]' : raw === 'glpi' ? '[GLPI]' : '[Whatsapp]'
    return { prefix, body: match[2] || '' }
  }
  return { prefix: '[Whatsapp]', body: String(title || '').trim() }
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function queueWaitLevel(iso) {
  if (!iso) return null
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes >= 60) return 'danger'
  if (minutes >= 15) return 'warning'
  return null
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
            <img src={url} alt={label} className="support-media-image" />
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
          <video src={url} controls className="support-media-video" />
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
      <div style={{ ...boxStyle, padding: 8, minWidth: 280 }}>
        <audio src={url} controls style={{ display: 'block', width: '100%' }} />
        <div style={{ ...actionStyle, paddingLeft: 0, paddingRight: 0 }}>
          <span>Áudio</span>
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
  const [searchParams] = useSearchParams()
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
  const [technicianOptions, setTechnicianOptions] = useState([])
  const [addTechId, setAddTechId] = useState('')
  const [transferTechId, setTransferTechId] = useState('')
  const [savingTech, setSavingTech] = useState(false)
  const [selectedFilePreview, setSelectedFilePreview] = useState(null)
  const [ticketPanelOpen, setTicketPanelOpen] = useState(false)
  const [ticketDetail, setTicketDetail] = useState(null)
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketSaving, setTicketSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [editTitle, setEditTitle] = useState('')
  const [editTitlePrefix, setEditTitlePrefix] = useState('[Whatsapp]')
  const [editCategory, setEditCategory] = useState('')
  const [editPriority, setEditPriority] = useState('')
  const [editUrgency, setEditUrgency] = useState('')
  const [editImpact, setEditImpact] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryCreating, setCategoryCreating] = useState(false)
  const threadEndRef = useRef(null)
  const threadBodyRef = useRef(null)
  const isNearBottomRef = useRef(true)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const lastMessageCountRef = useRef(null)

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

  useEffect(() => {
    const id = searchParams.get('conversation')
    if (id) setSelectedId(id)
  }, [searchParams])

  useEffect(() => {
    getUsers().then(setTechnicianOptions).catch(() => setTechnicianOptions([]))
  }, [])

  const loadDetail = useCallback(async (id) => {
    if (!id) { setDetail(null); return }
    try { setDetail(await getConversation(id)) } catch { setDetail(null) }
  }, [])

  useEffect(() => {
    lastMessageCountRef.current = null
    isNearBottomRef.current = true
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const handleThreadScroll = () => {
    const el = threadBodyRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    if (!selectedId) return
    const t = setInterval(() => loadDetail(selectedId), 3000)
    return () => clearInterval(t)
  }, [selectedId, loadDetail])

  useEffect(() => {
    const messages = detail?.messages
    if (!messages) return
    const prevCount = lastMessageCountRef.current
    lastMessageCountRef.current = messages.length
    if (prevCount === null || messages.length <= prevCount) return
    const newest = messages[messages.length - 1]
    if (newest && newest.author !== 'TECH') playAlertSound(3)
  }, [detail])

  useEffect(() => {
    if (isNearBottomRef.current) threadEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [detail])

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) { setSelectedFilePreview(null); return undefined }
    const url = URL.createObjectURL(selectedFile)
    setSelectedFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  const handleClaim = async (id) => {
    setClaimingId(id)
    try {
      await claimConversation(id)
      playAlertSound(4)
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
      isNearBottomRef.current = true
      setDetail(await replyToConversation(selectedId, message.trim(), selectedFile))
      setMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally { setSending(false) }
  }

  const startRecording = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { value: allowed } = await VoiceRecorder.requestAudioRecordingPermission()
        if (!allowed) {
          toast.add('Permissão de microfone negada.', 'error')
          return
        }
        await VoiceRecorder.startRecording()
        setRecording(true)
      } catch (e) {
        console.error('VoiceRecorder.startRecording falhou:', e)
        toast.add(`Não foi possível iniciar a gravação (${e.message || e}).`, 'error')
      }
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferredTypes = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm']
      const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
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
    } catch (e) {
      console.error('getUserMedia(audio) falhou:', e)
      toast.add(`Não foi possível acessar o microfone (${e.name || e.message || 'erro desconhecido'}).`, 'error')
    }
  }

  const stopRecording = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { value } = await VoiceRecorder.stopRecording()
        const blob = base64ToBlob(value.recordDataBase64, value.mimeType)
        const ext = value.fileExtension || 'm4a'
        setSelectedFile(new File([blob], `audio-tecnico-${Date.now()}.${ext}`, { type: value.mimeType }))
      } catch (e) {
        console.error('VoiceRecorder.stopRecording falhou:', e)
        toast.add(`Não foi possível finalizar a gravação (${e.message || e}).`, 'error')
      } finally {
        setRecording(false)
      }
      return
    }

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

  const handleAddTechnician = async () => {
    if (!addTechId || !selectedId) return
    setSavingTech(true)
    try {
      setDetail(await addTechnician(selectedId, addTechId))
      setAddTechId('')
      toast.add('Técnico adicionado ao atendimento.', 'success')
    } catch (e) {
      toast.add(e.response?.data?.message || 'Não foi possível adicionar o técnico.', 'error')
    } finally { setSavingTech(false) }
  }

  const handleRemoveTechnician = async (technicianId) => {
    if (!selectedId) return
    setSavingTech(true)
    try {
      setDetail(await removeTechnician(selectedId, technicianId))
      toast.add('Técnico removido do atendimento.', 'success')
    } catch {
      toast.add('Não foi possível remover o técnico.', 'error')
    } finally { setSavingTech(false) }
  }

  const handleTransfer = async () => {
    if (!transferTechId || !selectedId) return
    setSavingTech(true)
    try {
      await transferConversation(selectedId, transferTechId)
      setTransferTechId('')
      toast.add('Atendimento transferido.', 'success')
      loadLists(); loadDetail(selectedId)
    } catch (e) {
      toast.add(e.response?.data?.message || 'Não foi possível transferir o atendimento.', 'error')
    } finally { setSavingTech(false) }
  }

  const conversation = detail?.conversation
  const isOwner = conversation?.claimedById === user?.id
  const isAdmin = user?.role === 'ADMIN'
  const isSecondaryTechnician = conversation?.technicians?.some(t => t.id === user?.id) ?? false
  const canManage = (isOwner || isAdmin) && conversation?.state === 'HUMAN_ACTIVE'
  const isMine = (isOwner || isAdmin || isSecondaryTechnician) && conversation?.state === 'HUMAN_ACTIVE'
  const assignedIds = new Set([conversation?.claimedById, ...(conversation?.technicians?.map(t => t.id) ?? [])].filter(Boolean))
  const availableToAdd = technicianOptions.filter(t => t.active && !assignedIds.has(t.id))
  const availableToTransfer = technicianOptions.filter(t => t.active && t.id !== conversation?.claimedById)

  useEffect(() => {
    getCategories().then(res => setCategories(res.data)).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    setTicketPanelOpen(false)
    setTicketDetail(null)
  }, [selectedId])

  useEffect(() => {
    if (!ticketPanelOpen || !conversation?.glpiTicketId) return
    setTicketLoading(true)
    getTicket(conversation.glpiTicketId)
      .then(res => setTicketDetail(res.data))
      .catch(() => { setTicketDetail(null); toast.add('Não foi possível carregar os dados do chamado.', 'error') })
      .finally(() => setTicketLoading(false))
  }, [ticketPanelOpen, conversation?.glpiTicketId])

  useEffect(() => {
    if (!ticketDetail) return
    const { prefix, body } = splitLockedTitlePrefix(ticketDetail.ticket.title)
    setEditTitlePrefix(prefix)
    setEditTitle(body)
    setEditPriority(String(ticketDetail.ticket.priority || ''))
    setEditUrgency(String(ticketDetail.ticket.urgency || ''))
    setEditImpact(String(ticketDetail.ticket.impact || ''))
    const match = categories.find(c => c.name === ticketDetail.ticket.category)
    setEditCategory(match ? String(match.id) : '')
  }, [ticketDetail, categories])

  const handleSaveTicketFields = async () => {
    if (!conversation?.glpiTicketId) return
    const cleanTitle = editTitle.replace(/^\s*\[(Zabbix|WhatsApp|Whatsapp|GLPI)]\s*/i, '').trim()
    setTicketSaving(true)
    try {
      const fields = { itilcategories_id: editCategory ? parseInt(editCategory) : 0 }
      if (cleanTitle) fields.name = `${editTitlePrefix} ${cleanTitle}`
      if (editPriority) fields.priority = parseInt(editPriority)
      if (editUrgency) fields.urgency = parseInt(editUrgency)
      if (editImpact) fields.impact = parseInt(editImpact)
      await updateTicketFields(conversation.glpiTicketId, fields)
      const res = await getTicket(conversation.glpiTicketId)
      setTicketDetail(res.data)
      toast.add('Chamado atualizado.', 'success')
    } catch {
      toast.add('Não foi possível atualizar o chamado.', 'error')
    } finally {
      setTicketSaving(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setCategoryCreating(true)
    try {
      const res = await createCategory(newCategoryName.trim())
      const updated = await getCategories().then(r => r.data).catch(() => [...categories, res.data])
      setCategories(updated)
      setEditCategory(String(res.data.id))
      setNewCategoryName('')
      toast.add('Setor criado. Clique em Salvar para aplicar ao chamado.', 'success')
    } catch {
      toast.add('Não foi possível criar o setor.', 'error')
    } finally {
      setCategoryCreating(false)
    }
  }

  useEffect(() => {
    if (!isMine) return undefined
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      const fileItem = Array.from(items).find(i => i.kind === 'file')
      if (!fileItem) return
      const file = fileItem.getAsFile()
      if (!file) return
      e.preventDefault()
      const isGenericName = !file.name || /^(image|blob|clipboard)\.[a-z0-9]+$/i.test(file.name)
      const ext = (file.type.split('/')[1] || 'png').split('+')[0]
      const named = isGenericName ? new File([file], `print-${Date.now()}.${ext}`, { type: file.type }) : file
      setSelectedFile(named)
      toast.add('Imagem colada anexada — clique em Enviar.', 'success')
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [isMine, toast])

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>CRM de Suporte</h1>
            <p>Atendimentos iniciados pelo Hermes via WhatsApp</p>
          </div>
        </div>

        <div className="support-crm-grid">

          {/* Lists */}
          <div className="support-crm-lists">
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
                  {[...queue].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(c => {
                    const waitLevel = queueWaitLevel(c.createdAt)
                    return (
                      <div key={c.id} className="card" style={{ padding: '12px 14px',
                        border: waitLevel === 'danger' ? '1px solid var(--red-border, #dc2626)' : waitLevel === 'warning' ? '1px solid var(--amber-border, #d97706)' : undefined }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{c.contactName || c.contactPhone}</p>
                          {waitLevel === 'danger' && <span className="badge badge-red" style={{ fontSize: 9.5 }}>Espera &gt; 1h</span>}
                          {waitLevel === 'warning' && <span className="badge badge-amber" style={{ fontSize: 9.5 }}>Espera &gt; 15min</span>}
                        </div>
                        <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {c.glpiTicketId ? `Chamado #${c.glpiTicketId}` : '—'} · {timeAgo(c.createdAt)}
                        </p>
                        <button onClick={() => handleClaim(c.id)} disabled={claimingId === c.id} className="btn btn-primary btn-sm" style={{ marginTop: 8, width: '100%' }}>
                          {claimingId === c.id ? 'Assumindo...' : 'Atender'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="label-caps" style={{ marginBottom: 8 }}>Meus atendimentos</p>
              {mine.length === 0 ? (
                <div className="card empty-state" style={{ padding: '16px 14px' }}><p style={{ fontSize: 12.5 }}>Nenhum atendimento em andamento</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...mine].sort((a, b) => Number(b.lastMessageAuthor === 'EMPLOYEE') - Number(a.lastMessageAuthor === 'EMPLOYEE')).map(c => {
                    const awaitingReply = c.lastMessageAuthor === 'EMPLOYEE'
                    return (
                      <button key={c.id} onClick={() => setSelectedId(c.id)}
                        className="card card-hover" style={{ padding: '12px 14px', textAlign: 'left', width: '100%', cursor: 'pointer',
                          border: selectedId === c.id ? '2px solid var(--accent)' : awaitingReply ? '1px solid var(--warning, #d97706)' : '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{c.contactName || c.contactPhone}</p>
                          {awaitingReply && <span className="badge badge-amber" style={{ fontSize: 9.5 }}>Aguardando resposta</span>}
                        </div>
                        <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {c.glpiTicketId ? `Chamado #${c.glpiTicketId}` : '—'} · {timeAgo(c.lastMessageAt || c.claimedAt)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Thread */}
          <div className="card support-thread-card">
            {!conversation ? (
              <div className="empty-state" style={{ margin: 'auto' }}><h3>Selecione um atendimento</h3><p>Escolha um item na fila ou em "Meus atendimentos".</p></div>
            ) : (
              <>
                <div className="support-thread-header-wrap">
                  <div className="support-thread-header">
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text-primary)' }}>{conversation.contactName || conversation.contactPhone}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {conversation.contactPhone} · {conversation.glpiTicketId ? `Chamado #${conversation.glpiTicketId}` : 'sem chamado'} · {STATE_LABEL[conversation.state] ?? conversation.state}
                        {conversation.glpiTicketId && isMine && (
                          <button type="button" onClick={() => setTicketPanelOpen(o => !o)}
                            style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, marginLeft: 8, fontSize: 12, color: 'var(--accent)', textDecoration: 'underline' }}>
                            {ticketPanelOpen ? 'Fechar edição do chamado' : 'Editar assunto/prioridade/setor'}
                          </button>
                        )}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {conversation.claimedByName && (
                          <span className="badge badge-blue" style={{ fontSize: 10.5 }}>👨‍💻 {conversation.claimedByName}</span>
                        )}
                        {conversation.technicians?.map(t => (
                          <span key={t.id} className="badge badge-gray" style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {t.name}
                            {canManage && (
                              <button type="button" onClick={() => handleRemoveTechnician(t.id)} disabled={savingTech}
                                style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, fontSize: 11, color: 'inherit', opacity: 0.7 }} title="Remover técnico">✕</button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                    {conversation.state === 'HUMAN_ACTIVE' && (
                      <button onClick={handleClose} disabled={closing} className="btn btn-danger btn-sm">{closing ? 'Fechando...' : 'Fechar chamado'}</button>
                    )}
                  </div>

                  {canManage && (
                    <div className="support-thread-tech-controls">
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={addTechId} onChange={e => setAddTechId(e.target.value)} disabled={savingTech} className="input" style={{ fontSize: 12, height: 32, padding: '2px 8px' }}>
                          <option value="">+ Adicionar técnico...</option>
                          {availableToAdd.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button onClick={handleAddTechnician} disabled={!addTechId || savingTech} className="btn btn-default btn-sm">Adicionar</button>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={transferTechId} onChange={e => setTransferTechId(e.target.value)} disabled={savingTech} className="input" style={{ fontSize: 12, height: 32, padding: '2px 8px' }}>
                          <option value="">Transferir para...</option>
                          {availableToTransfer.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button onClick={handleTransfer} disabled={!transferTechId || savingTech} className="btn btn-default btn-sm">Transferir</button>
                      </div>
                    </div>
                  )}

                  {ticketPanelOpen && conversation.glpiTicketId && isMine && (
                    <div className="card" style={{ padding: 12, marginTop: 8, background: 'var(--bg-subtle)' }}>
                      {ticketLoading || !ticketDetail ? (
                        <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
                      ) : (
                        <>
                          <div style={{ marginBottom: 10 }}>
                            <label className="input-label">Assunto do chamado</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span className="badge badge-default" style={{ fontSize: 10.5 }} title="Tag de origem bloqueada — não pode ser alterada">
                                {editTitlePrefix}
                              </span>
                              <input
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value.replace(/^\s*\[(Zabbix|WhatsApp|Whatsapp|GLPI)]\s*/i, ''))}
                                className="input"
                                style={{ fontSize: 12.5 }}
                                placeholder="Digite só o assunto do chamado"
                              />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                            <div>
                              <label className="input-label">Setor</label>
                              <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="input" style={{ fontSize: 12.5 }}>
                                <option value="">Sem setor</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="input-label">Prioridade</label>
                              <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="input" style={{ fontSize: 12.5 }}>
                                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="input-label">Urgência</label>
                              <select value={editUrgency} onChange={e => setEditUrgency(e.target.value)} className="input" style={{ fontSize: 12.5 }}>
                                {URGENCY_IMPACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="input-label">Impacto</label>
                              <select value={editImpact} onChange={e => setEditImpact(e.target.value)} className="input" style={{ fontSize: 12.5 }}>
                                {URGENCY_IMPACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 200, flex: 1 }}>
                              <label className="input-label">Criar novo setor</label>
                              <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="input" style={{ fontSize: 12.5 }} placeholder="Ex.: Financeiro, Comercial..." />
                            </div>
                            <button onClick={handleCreateCategory} disabled={categoryCreating || !newCategoryName.trim()} className="btn btn-default btn-sm">
                              {categoryCreating ? 'Criando...' : 'Criar setor'}
                            </button>
                            <button onClick={handleSaveTicketFields} disabled={ticketSaving} className="btn btn-primary btn-sm">
                              {ticketSaving ? 'Salvando...' : 'Salvar chamado'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="support-thread-body" ref={threadBodyRef} onScroll={handleThreadScroll}>
                  {detail.messages.map(m => {
                    const mine = m.author === 'TECH'
                    const system = m.author === 'HERMES'
                    return (
                      <div key={m.id} className={`support-message-row ${mine ? 'is-tech' : 'is-customer'}`}>
                        <div style={{
                          padding: '8px 12px', borderRadius: 'var(--r-lg)',
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

                <form onSubmit={handleSend} className="support-reply-form">
                  {selectedFile && (
                    <div className="support-selected-file">
                      {selectedFilePreview && <img src={selectedFilePreview} alt="" className="support-selected-file-thumb" />}
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>📎 {selectedFile.name} · {formatBytes(selectedFile.size)}</span>
                      <button type="button" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="btn btn-default btn-sm">Remover</button>
                    </div>
                  )}
                  <div className="support-composer-row">
                    <input
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      disabled={!isMine}
                      placeholder={isMine ? 'Escreva uma resposta, anexe ou cole (Ctrl+V) um print...' : conversation.state === 'HUMAN_ACTIVE' ? 'Atendido por outro técnico' : 'Atendimento não está ativo'}
                      className="input support-composer-input"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
                      disabled={!isMine || sending || recording}
                      onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                      style={{ display: 'none' }}
                    />
                    <button type="button" disabled={!isMine || sending || recording} onClick={() => fileInputRef.current?.click()} className="btn btn-default support-composer-action">Anexar</button>
                    {recording ? (
                      <button type="button" onClick={stopRecording} className="btn btn-danger support-composer-action">Parar áudio</button>
                    ) : (
                      <button type="button" disabled={!isMine || sending || selectedFile} onClick={startRecording} className="btn btn-default support-composer-action">Gravar áudio</button>
                    )}
                    <button type="submit" disabled={!isMine || sending || recording || (!message.trim() && !selectedFile)} className="btn btn-primary support-composer-send">{sending ? 'Enviando...' : 'Enviar'}</button>
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

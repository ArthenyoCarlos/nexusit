import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { VoiceRecorder } from '@independo/capacitor-voice-recorder'
import Layout from '../components/Layout'
import { useTheme } from '../contexts/ThemeContext'
import { readCandidate, shouldMarkRead, validateAttachment, validateAudioCaption, uploadError } from '../utils/supportCrm'
import './SupportCrmPage.css'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { markConversationRead, getQueue, getMine, getConversation, getMessageMediaBlob, claimConversation, replyToConversation, closeConversation, addTechnician, removeTechnician, transferConversation } from '../services/support'
import { getTicket, updateTicketFields, getCategories, createCategory } from '../services/glpi'
import { getUsers } from '../services/users'
import { playAlertSound } from '../utils/alertSound'

const initials = value => String(value || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()
const clock = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : ''
const day = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'}) : 'Histórico'
function Icon({name}) {
  const paths = {search:'m21 21-5-5 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0', back:'m15 18-6-6 6-6', more:'M12 5h.01 M12 12h.01 M12 19h.01', attach:'m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2', mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8', send:'m22 2-7 20-4-9-9-4 20-7z M22 2 11 13'}
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>
}

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
  const { theme, toggleTheme } = useTheme()
  const [filter, setFilter] = useState('Todas')
  const [search, setSearch] = useState('')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [sendError, setSendError] = useState('')
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [readStatus, setReadStatus] = useState('')
  const selectedRef = useRef(null)
  const detailRef = useRef(null)
  const readLedger = useRef(new Map())
  const detailBusy = useRef(new Set())
  const listsBusy = useRef(false)
  const cancelledRecording = useRef(false)
  const recordingTarget = useRef(null)
  const mounted = useRef(true)
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
    if (listsBusy.current) return
    listsBusy.current = true
    try {
      const [q, m] = await Promise.all([getQueue(), getMine()])
      if (mounted.current) { setQueue(q); setMine(m) }
    } catch { /* Preserve last successful lists on transient errors. */ }
    finally { listsBusy.current = false; if (mounted.current) setLoading(false) }
  }, [])

  useEffect(() => {
    loadLists()
    const t = setInterval(loadLists, 4000)
    return () => clearInterval(t)
  }, [loadLists])

  useEffect(() => {
    const id = searchParams.get('conversation')
    if (id && !selectedRef.current) { selectedRef.current = id; setSelectedId(id) }
  }, [searchParams])

  useEffect(() => {
    getUsers().then(setTechnicianOptions).catch(() => setTechnicianOptions([]))
  }, [])

  const loadDetail = useCallback(async (id) => {
    if (!id) { setDetail(null); return }
    if (detailBusy.current.has(String(id))) return
    detailBusy.current.add(String(id))
    try {
      const data = await getConversation(id)
      if (mounted.current && String(selectedRef.current) === String(id)) setDetail(data)
    } catch { /* Keep the current thread during transient polling failures. */ }
    finally { detailBusy.current.delete(String(id)) }
  }, [])

  useEffect(() => {
    selectedRef.current = selectedId
    setDetail(null)
    setReadStatus(readLedger.current.get(String(selectedId))?.remoteRead || '')
    setToolsOpen(false)
    lastMessageCountRef.current = null
    isNearBottomRef.current = true
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  detailRef.current = detail
  const attemptRead = useCallback(async () => {
    const id = selectedRef.current
    const data = detailRef.current
    const candidate = readCandidate(data?.messages)
    const previous = readLedger.current.get(String(id))
    const el = threadBodyRef.current
    if (!shouldMarkRead({ candidate, previous, open: !!id && String(data?.conversation?.id) === String(id) && !!el?.getClientRects().length,
      visible: document.visibilityState === 'visible', nearBottom: isNearBottomRef.current })) return
    const entry = { id: candidate, inFlight: true, attempts: previous?.id === candidate ? (previous.attempts || 0) + 1 : 1 }
    readLedger.current.set(String(id), entry)
    try {
      const result = await markConversationRead(id, candidate)
      Object.assign(entry, result, { inFlight: false, retryAt: Date.now() + Math.min(60000, 5000 * 2 ** (entry.attempts - 1)) })
      if (String(selectedRef.current) !== String(id)) return
      setReadStatus(result.remoteRead)
      if (result.localRead) {
        const update = list => list.map(c => String(c.id) === String(id) ? { ...c, unreadCount: result.unreadCount } : c)
        setQueue(update); setMine(update)
      }
    } catch {
      Object.assign(entry, { inFlight: false, remoteRead: 'PENDING', retryAt: Date.now() + Math.min(60000, 5000 * 2 ** (entry.attempts - 1)) })
    }
  }, [])
  useEffect(() => {
    const check = () => attemptRead()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [attemptRead])
  const handleThreadScroll = () => {
    const el = threadBodyRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    attemptRead()
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
    const timer = setTimeout(attemptRead, 350)
    return () => clearTimeout(timer)
  }, [detail])

  useEffect(() => {
    if (!selectedFile || !(selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('audio/'))) { setSelectedFilePreview(null); return undefined }
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

  const selectConversation = id => {
    if (sending || recording || savingTech || ticketSaving || closing || claimingId) { toast.add('Finalize ou cancele o áudio/envio antes de trocar de conversa.', 'warning'); return }
    if ((message.trim() || selectedFile) && !window.confirm('Descartar o rascunho desta conversa?')) return
    selectedRef.current = id
    setMessage(''); setSelectedFile(null); setSendError('')
    setSelectedId(id)
  }
  const handleSend = async (e) => {
    e.preventDefault()
    if (sending || recording || (!message.trim() && !selectedFile) || !selectedId || !isMine) return
    const invalid = validateAttachment(selectedFile) || validateAudioCaption(message, selectedFile)
    if (invalid) { setSendError(invalid); return }
    const target = selectedId
    setSending(true); setSendError(''); setUploadProgress(0)
    try {
      const response = await replyToConversation(target, message.trim(), selectedFile, progress => {
        setUploadProgress(progress.total ? Math.round(progress.loaded * 100 / progress.total) : 0)
      })
      if (String(selectedRef.current) === String(target)) {
        isNearBottomRef.current = true
        setDetail(response); setMessage(''); setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch (error) { setSendError(uploadError(error)) }
    finally { setSending(false) }
  }

  const startRecording = async () => {
    cancelledRecording.current = false
    recordingTarget.current = selectedRef.current
    setRecordSeconds(0)
    setRecording(true)
    if (Capacitor.isNativePlatform()) {
      try {
        const { value: allowed } = await VoiceRecorder.requestAudioRecordingPermission()
        if (!allowed) {
          setRecording(false)
          toast.add('Permissão de microfone negada.', 'error')
          return
        }
        if (!mounted.current || cancelledRecording.current || recordingTarget.current !== selectedRef.current) { setRecording(false); return }
        await VoiceRecorder.startRecording()
        if (!mounted.current || cancelledRecording.current) { await VoiceRecorder.stopRecording(); setRecording(false); return }
        setRecording(true)
      } catch (e) {
        setRecording(false)
        console.error('VoiceRecorder.startRecording falhou:', e)
        toast.add(`Não foi possível iniciar a gravação (${e.message || e}).`, 'error')
      }
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current || cancelledRecording.current || recordingTarget.current !== selectedRef.current) { stream.getTracks().forEach(t => t.stop()); setRecording(false); return }
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
        if (mounted.current && !cancelledRecording.current && recordingTarget.current === selectedRef.current) setSelectedFile(new File([blob], `audio-tecnico-${Date.now()}.${ext}`, { type }))
        setRecording(false)
      }
      mediaRecorderRef.current = recorder
      recorder.start(1000)
      setRecording(true)
    } catch (e) {
      setRecording(false)
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
        if (mounted.current && !cancelledRecording.current && recordingTarget.current === selectedRef.current) setSelectedFile(new File([blob], `audio-tecnico-${Date.now()}.${ext}`, { type: value.mimeType }))
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

  const cancelRecording = () => {
    cancelledRecording.current = true
    stopRecording()
  }
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setRecordSeconds(n => n + 1), 1000)
    return () => clearInterval(timer)
  }, [recording])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      cancelledRecording.current = true
      const recorder = mediaRecorderRef.current
      if (recorder?.state !== 'inactive' && recorder) recorder.stop()
      recorder?.stream?.getTracks().forEach(track => track.stop())
      if (Capacitor.isNativePlatform()) VoiceRecorder.stopRecording().catch(() => {})
    }
  }, [])

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
    let active = true
    setTicketLoading(true)
    getTicket(conversation.glpiTicketId)
      .then(res => { if (active) setTicketDetail(res.data) })
      .catch(() => { if (active) { setTicketDetail(null); toast.add('Não foi possível carregar os dados do chamado.', 'error') } })
      .finally(() => { if (active) setTicketLoading(false) })
    return () => { active = false }
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
      <div className={`crm page fade-up ${selectedId ? 'crm-chat-open' : ''}`}>
        <div className="crm-topline"><span>Atendimento <b>WhatsApp</b></span><span className="crm-topnote">NexusIT · Central de suporte</span></div>
        <div className="support-crm-grid crm-shell">
          <aside className="support-crm-lists crm-sidebar">
            <div className="crm-list-heading"><h1>Conversas</h1><button type="button" className="crm-icon" onClick={toggleTheme} aria-label="Alternar tema">{theme === 'dark' ? '☀' : '☾'}</button></div>
            <label className="crm-search"><Icon name="search"/><input aria-label="Buscar conversas" placeholder="Buscar nome ou telefone" value={search} onChange={e => setSearch(e.target.value)}/></label>
            <div className="crm-filters">{['Todas','Não lidas','Fila','Meus'].map(f => <button type="button" key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>
            <div className="crm-conversations">
              {loading && <p className="crm-empty">Carregando conversas…</p>}
              {Array.from(new Map([...queue, ...mine].map(c => [c.id, c])).values())
                .filter(c => (!search || `${c.contactName} ${c.contactPhone}`.toLowerCase().includes(search.toLowerCase())) && (filter !== 'Não lidas' || c.unreadCount > 0) && (filter !== 'Fila' || queue.some(q => q.id === c.id)) && (filter !== 'Meus' || mine.some(m => m.id === c.id)))
                .sort((a,b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt))
                .map(c => <button type="button" key={c.id} onClick={() => selectConversation(c.id)} className={`crm-conversation ${String(selectedId) === String(c.id) ? 'active' : ''}`}>
                  <span className="crm-avatar">{initials(c.contactName || c.contactPhone)}</span>
                  <span className="crm-contact"><span className="crm-contact-title"><strong>{c.contactName || c.contactPhone}</strong><time>{clock(c.lastMessageAt || c.createdAt)}</time></span>
                    <span className="crm-contact-preview"><span>{c.lastMessagePreview || c.lastMessageContent || STATE_LABEL[c.state] || 'Conversa de suporte'}</span>{c.unreadCount > 0 && <b className="crm-unread">{c.unreadCount}</b>}</span>
                    <small>{queue.some(q => q.id === c.id) ? 'Fila · ' : ''}{c.glpiTicketId ? `Chamado #${c.glpiTicketId}` : 'Sem chamado'}</small>
                  </span>
                </button>)}
              {!loading && !queue.length && !mine.length && <p className="crm-empty">Nenhuma conversa no momento.</p>}
            </div>
            <footer className="crm-list-footer">Mensagens e chamados, em um só lugar</footer>
          </aside>

          {/* Thread */}
          <div className="card support-thread-card">
            {!conversation ? (
              <div className="empty-state" style={{ margin: 'auto' }}><h3>Selecione um atendimento</h3><p>Escolha um item na fila ou em "Meus atendimentos".</p></div>
            ) : (
              <>
                <div className="support-thread-header-wrap">
                  <div className="support-thread-header">
                    <button type="button" className="crm-back crm-icon" onClick={() => selectConversation(null)} aria-label="Voltar às conversas"><Icon name="back"/></button>
                    <span className="crm-avatar">{initials(conversation.contactName || conversation.contactPhone)}</span>
                    <div className="crm-header-contact">
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
                    <button type="button" className="crm-icon" onClick={() => setToolsOpen(o => !o)} aria-label="Ações do atendimento"><Icon name="more"/></button>
                    {conversation.state === 'PENDING_TECH' && <button onClick={() => handleClaim(conversation.id)} disabled={!!claimingId || sending} className="btn btn-primary btn-sm">Atender</button>}
                    {toolsOpen && conversation.state === 'HUMAN_ACTIVE' && (
                      <button onClick={handleClose} disabled={closing} className="btn btn-danger btn-sm">{closing ? 'Fechando...' : 'Fechar chamado'}</button>
                    )}
                  </div>

                  {canManage && toolsOpen && (
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
                  {detail.messages.map((m, index) => {
                    const mine = m.author === 'TECH' || m.direction === 'OUT'
                    const system = m.author === 'HERMES'
                    return (
                      <div key={m.id} className="crm-message-group">
                      {(!index || day(m.createdAt) !== day(detail.messages[index - 1].createdAt)) && <div className="crm-date"><span>{day(m.createdAt)}</span></div>}
                      <div className={`support-message-row ${mine ? 'is-tech' : 'is-customer'}`}>
                        <div className={`crm-bubble ${system ? 'crm-system' : ''}`}>
                          {!mine && <p style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>{m.authorName}</p>}
                          {m.content && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.content}</p>}
                          <MediaAttachment message={m} />
                          <div className="crm-message-meta"><time>{clock(m.createdAt)}</time>{mine && <span title="Aceito pela API; não indica entrega ou leitura pelo destinatário">Enviado</span>}</div>
                        </div>
                      </div>
                      </div>
                    )
                  })}
                  <div ref={threadEndRef} />
                </div>

                <div className="crm-read-status">{readStatus === 'CONFIRMED' ? 'Leitura das entradas sincronizada com WhatsApp' : readStatus === 'UNAVAILABLE' ? 'Lida no CRM · confirmação WhatsApp indisponível' : readStatus === 'PENDING' ? 'Lida no CRM · sincronização WhatsApp pendente' : ''}</div>
                <form onSubmit={handleSend} className="support-reply-form">
                  {selectedFile && (
                    <div className="support-selected-file">
                      {selectedFilePreview && selectedFile.type.startsWith('audio/') && <audio controls src={selectedFilePreview} aria-label="Ouvir áudio antes de enviar" />}
                      {selectedFilePreview && selectedFile.type.startsWith('image/') && <img src={selectedFilePreview} alt="" className="support-selected-file-thumb" />}
                      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>📎 {selectedFile.name} · {formatBytes(selectedFile.size)}</span>
                      <button type="button" disabled={sending} onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="btn btn-default btn-sm">Remover</button>
                    </div>
                  )}
                  {recording && <div className="crm-recording" role="status"><span className="crm-record-dot"/> Gravando {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')} <button type="button" className="btn btn-default btn-sm" onClick={cancelRecording}>Cancelar gravação</button></div>}
                  {sending && <div className="crm-upload" role="status">{selectedFile ? uploadProgress < 100 ? `Enviando arquivo… ${uploadProgress}%` : 'Processando / convertendo e enviando ao WhatsApp…' : 'Enviando mensagem…'}<progress max="100" value={uploadProgress}/></div>}
                  {sendError && <p className="crm-error" role="alert">{sendError}</p>}
                  <div className="support-composer-row">
                    <input
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      disabled={!isMine || sending || recording}
                      aria-label="Mensagem"
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
                    <button type="button" disabled={!isMine || sending || recording} onClick={() => fileInputRef.current?.click()} className="btn btn-default support-composer-action" aria-label="Anexar arquivo" title="Anexar arquivo"><Icon name="attach"/></button>
                    {recording ? (
                      <button type="button" onClick={stopRecording} className="btn btn-danger support-composer-action">Parar áudio</button>
                    ) : (
                      <button type="button" disabled={!isMine || sending || selectedFile} onClick={startRecording} className="btn btn-default support-composer-action" aria-label="Gravar áudio" title="Gravar áudio"><Icon name="mic"/></button>
                    )}
                    <button type="submit" disabled={!isMine || sending || recording || (!message.trim() && !selectedFile)} aria-label="Enviar mensagem" className="btn btn-primary support-composer-send">{sending ? '…' : <><Icon name="send"/><span className="crm-send-label">Enviar</span></>}</button>
                  </div>
                  <small className="crm-limits">Entrada até 32 MB · áudio convertido até 16 MB. A duração não define o tamanho.</small>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

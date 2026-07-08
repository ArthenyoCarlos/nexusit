import { useState, useEffect, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getQueue, getMine, getConversation, claimConversation, replyToConversation, closeConversation } from '../services/support'

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
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)
  const threadEndRef = useRef(null)

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
    if (!message.trim() || !selectedId) return
    setSending(true)
    try {
      setDetail(await replyToConversation(selectedId, message.trim()))
      setMessage('')
    } finally { setSending(false) }
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
                          <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={threadEndRef} />
                </div>

                <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border-muted)' }}>
                  <input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    disabled={!isMine}
                    placeholder={isMine ? 'Escreva uma resposta...' : conversation.state === 'HUMAN_ACTIVE' ? 'Atendido por outro técnico' : 'Atendimento não está ativo'}
                    className="input" style={{ flex: 1 }}
                  />
                  <button type="submit" disabled={!isMine || sending || !message.trim()} className="btn btn-primary">{sending ? 'Enviando...' : 'Enviar'}</button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { useToast } from '../contexts/ToastContext'
import {
  getBroadcastContacts, getBroadcastGroups, discoverGroups, saveGroup,
  deleteGroup, sendBroadcast, getBroadcastHistory,
} from '../services/broadcast'

function formatDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function errorMessage(e, fallback) {
  return e.response?.data?.detail || e.response?.data?.message || fallback
}

const TARGET_LABEL = { CONTACT: '👤 Contato', GROUP: '👥 Grupo' }

export default function BroadcastPage() {
  const toast = useToast()

  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const [targetType, setTargetType] = useState('CONTACT')
  const [targetId, setTargetId] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [discovered, setDiscovered] = useState([])
  const [discovering, setDiscovering] = useState(false)
  const [savingJid, setSavingJid] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [c, g, h] = await Promise.all([getBroadcastContacts(), getBroadcastGroups(), getBroadcastHistory()])
      setContacts(c); setGroups(g); setHistory(h)
    } catch {
      toast.add('Não foi possível carregar os dados de disparo.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  const targets = targetType === 'CONTACT' ? contacts : groups

  const handleTargetType = (type) => {
    setTargetType(type)
    setTargetId('')
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!targetId || !message.trim()) return
    setSending(true)
    try {
      await sendBroadcast(targetType, targetId, message.trim())
      toast.add('Mensagem enviada.', 'success')
      setMessage('')
      const h = await getBroadcastHistory()
      setHistory(h)
    } catch (e) {
      toast.add(errorMessage(e, 'Não foi possível enviar a mensagem.'), 'error')
    } finally {
      setSending(false)
    }
  }

  const openDiscover = async () => {
    setDiscoverOpen(true)
    setDiscovering(true)
    try {
      setDiscovered(await discoverGroups())
    } catch {
      toast.add('Não foi possível buscar os grupos do WhatsApp. Verifique a conexão com a Evolution API.', 'error')
      setDiscovered([])
    } finally {
      setDiscovering(false)
    }
  }

  const handleSaveGroup = async (g) => {
    setSavingJid(g.groupJid)
    try {
      await saveGroup(g.name, g.groupJid)
      setDiscovered(prev => prev.map(d => d.groupJid === g.groupJid ? { ...d, alreadySaved: true } : d))
      setGroups(await getBroadcastGroups())
      toast.add(`Grupo "${g.name}" salvo.`, 'success')
    } catch {
      toast.add('Não foi possível salvar o grupo.', 'error')
    } finally {
      setSavingJid(null)
    }
  }

  const handleDeleteGroup = async (id) => {
    setDeletingId(id)
    try {
      await deleteGroup(id)
      setGroups(prev => prev.filter(g => g.id !== id))
      if (targetType === 'GROUP' && targetId === id) setTargetId('')
      toast.add('Grupo removido.', 'success')
    } catch {
      toast.add('Não foi possível remover o grupo.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Disparo WhatsApp</h1>
            <p>Envie uma mensagem avulsa para um contato ou grupo do WhatsApp</p>
          </div>
        </div>

        <div className="broadcast-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

            {/* Composer */}
            <form onSubmit={handleSend} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p className="label-caps" style={{ margin: 0 }}>Nova mensagem</p>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => handleTargetType('CONTACT')}
                  className={`btn btn-sm ${targetType === 'CONTACT' ? 'btn-primary' : 'btn-default'}`}>👤 Contato</button>
                <button type="button" onClick={() => handleTargetType('GROUP')}
                  className={`btn btn-sm ${targetType === 'GROUP' ? 'btn-primary' : 'btn-default'}`}>👥 Grupo</button>
              </div>

              <div>
                <label className="input-label">{targetType === 'CONTACT' ? 'Contato' : 'Grupo'}</label>
                <select value={targetId} onChange={e => setTargetId(e.target.value)} className="input" disabled={loading}>
                  <option value="">Selecione...</option>
                  {targets.map(t => (
                    <option key={t.id} value={t.id}>{t.displayName || t.name || t.phoneNumber || t.groupJid}</option>
                  ))}
                </select>
                {targetType === 'CONTACT' && !loading && contacts.length === 0 && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Nenhum contato ainda — contatos aparecem aqui depois que alguém fala com o Hermes pelo WhatsApp.
                  </p>
                )}
                {targetType === 'GROUP' && !loading && groups.length === 0 && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Nenhum grupo salvo ainda — use "Sincronizar grupos" ao lado para adicionar um.
                  </p>
                )}
              </div>

              <div>
                <label className="input-label">Mensagem</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Escreva a mensagem do zero..." rows={5} className="input resize-none" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={!targetId || !message.trim() || sending} className="btn btn-primary">
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>

            {/* History */}
            <div className="card" style={{ padding: 20 }}>
              <p className="label-caps" style={{ marginBottom: 10 }}>Histórico de disparos</p>
              {loading ? (
                <div className="skeleton" style={{ height: 60, borderRadius: 10 }} />
              ) : history.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Nenhum disparo ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map(h => (
                    <div key={h.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-muted)', background: 'var(--bg-subtle)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span className="badge badge-gray">{TARGET_LABEL[h.targetType] ?? h.targetType}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{h.targetLabel}</span>
                        <span className={`badge ${h.action === 'SEND' ? 'badge-green' : 'badge-red'}`}>
                          {h.action === 'SEND' ? 'Enviado' : 'Falhou'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                          {h.actorName ? `${h.actorName} · ` : ''}{formatDate(h.createdAt)}
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>{h.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Saved groups */}
          <div className="card" style={{ padding: 20, alignSelf: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <p className="label-caps" style={{ margin: 0 }}>Grupos salvos</p>
              <button type="button" onClick={openDiscover} className="btn btn-default btn-sm">Sincronizar</button>
            </div>
            {loading ? (
              <div className="skeleton" style={{ height: 60, borderRadius: 10 }} />
            ) : groups.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Nenhum grupo salvo. Clique em "Sincronizar" para buscar os grupos do WhatsApp conectado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-muted)' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                    <button type="button" onClick={() => handleDeleteGroup(g.id)} disabled={deletingId === g.id}
                      className="btn btn-default btn-sm" style={{ flexShrink: 0 }}>
                      {deletingId === g.id ? '...' : 'Remover'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Modal open={discoverOpen} onClose={() => setDiscoverOpen(false)} title="Grupos do WhatsApp" size="md">
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Grupos que a conta de WhatsApp conectada participa. Salve os que devem ficar disponíveis como destino de disparo.
          </p>
          {discovering ? (
            <div className="skeleton" style={{ height: 80, borderRadius: 10 }} />
          ) : discovered.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Nenhum grupo encontrado (ou a Evolution API não respondeu).</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              {discovered.map(g => (
                <div key={g.groupJid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-muted)' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{g.participantCount > 0 ? `${g.participantCount} participantes` : ''}</p>
                  </div>
                  {g.alreadySaved ? (
                    <span className="badge badge-green" style={{ flexShrink: 0 }}>Salvo</span>
                  ) : (
                    <button type="button" onClick={() => handleSaveGroup(g)} disabled={savingJid === g.groupJid}
                      className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                      {savingJid === g.groupJid ? 'Salvando...' : 'Salvar'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  )
}

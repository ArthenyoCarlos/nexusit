import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { useToast } from '../contexts/ToastContext'
import {
  getBroadcastContacts, getBroadcastGroups, discoverGroups, saveGroup,
  deleteGroup, sendBroadcast, getBroadcastHistory,
  getRules, createRule, updateRule, setRuleActive, deleteRule, triggerRule,
} from '../services/broadcast'
import { getHosts } from '../services/monitoring'

function formatDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function errorMessage(e, fallback) {
  return e.response?.data?.detail || e.response?.data?.message || fallback
}

const TARGET_LABEL = { CONTACT: '👤 Contato', GROUP: '👥 Grupo' }
const MODE_LABEL = { MANUAL: '🖐️ Manual', AUTOMATIC: '⚡ Automático' }

const EMPTY_RULE_FORM = { name: '', hostId: '', message: '', targetType: 'CONTACT', targetId: '', mode: 'MANUAL', cooldownMinutes: 30 }

export default function BroadcastPage() {
  const toast = useToast()
  const [tab, setTab] = useState('send')

  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [history, setHistory] = useState([])
  const [hosts, setHosts] = useState([])
  const [rules, setRules] = useState([])
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

  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM)
  const [savingRule, setSavingRule] = useState(false)
  const [triggeringId, setTriggeringId] = useState(null)
  const [deletingRuleId, setDeletingRuleId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [c, g, h, hs, r] = await Promise.all([
        getBroadcastContacts(), getBroadcastGroups(), getBroadcastHistory(),
        getHosts().then(res => res.data), getRules(),
      ])
      setContacts(c); setGroups(g); setHistory(h); setHosts(hs); setRules(r)
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
      setHistory(await getBroadcastHistory())
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

  const ruleTargets = ruleForm.targetType === 'CONTACT' ? contacts : groups

  const openNewRule = () => {
    setEditingRuleId(null)
    setRuleForm(EMPTY_RULE_FORM)
    setRuleModalOpen(true)
  }

  const openEditRule = (r) => {
    setEditingRuleId(r.id)
    setRuleForm({
      name: r.name, hostId: r.hostId, message: r.message,
      targetType: r.targetType, targetId: r.targetId,
      mode: r.mode, cooldownMinutes: r.cooldownMinutes,
    })
    setRuleModalOpen(true)
  }

  const handleRuleFormTargetType = (type) => {
    setRuleForm(prev => ({ ...prev, targetType: type, targetId: '' }))
  }

  const handleSaveRule = async (e) => {
    e.preventDefault()
    if (!ruleForm.name.trim() || !ruleForm.hostId || !ruleForm.targetId || !ruleForm.message.trim()) return
    setSavingRule(true)
    try {
      const host = hosts.find(h => h.id === ruleForm.hostId)
      const payload = {
        name: ruleForm.name.trim(),
        hostId: ruleForm.hostId,
        hostName: host?.name || '',
        message: ruleForm.message.trim(),
        targetType: ruleForm.targetType,
        targetId: ruleForm.targetId,
        mode: ruleForm.mode,
        cooldownMinutes: Number(ruleForm.cooldownMinutes) || 30,
      }
      if (editingRuleId) {
        await updateRule(editingRuleId, payload)
        toast.add('Regra atualizada.', 'success')
      } else {
        await createRule(payload)
        toast.add('Regra criada.', 'success')
      }
      setRuleModalOpen(false)
      setRules(await getRules())
    } catch (e) {
      toast.add(errorMessage(e, 'Não foi possível salvar a regra.'), 'error')
    } finally {
      setSavingRule(false)
    }
  }

  const handleToggleRule = async (r) => {
    setTogglingId(r.id)
    try {
      const updated = await setRuleActive(r.id, !r.active)
      setRules(prev => prev.map(x => x.id === r.id ? updated : x))
    } catch {
      toast.add('Não foi possível atualizar a regra.', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  const handleTriggerRule = async (r) => {
    setTriggeringId(r.id)
    try {
      await triggerRule(r.id)
      toast.add(`Regra "${r.name}" disparada.`, 'success')
      setRules(await getRules())
    } catch (e) {
      toast.add(errorMessage(e, 'Não foi possível disparar a regra.'), 'error')
    } finally {
      setTriggeringId(null)
    }
  }

  const handleDeleteRule = async (id) => {
    setDeletingRuleId(id)
    try {
      await deleteRule(id)
      setRules(prev => prev.filter(r => r.id !== id))
      toast.add('Regra removida.', 'success')
    } catch {
      toast.add('Não foi possível remover a regra.', 'error')
    } finally {
      setDeletingRuleId(null)
    }
  }

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Disparo WhatsApp</h1>
            <p>Envie mensagens avulsas ou configure regras de alerta a partir do Zabbix</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button type="button" onClick={() => setTab('send')} className={`btn btn-sm ${tab === 'send' ? 'btn-primary' : 'btn-default'}`}>Disparo manual</button>
          <button type="button" onClick={() => setTab('rules')} className={`btn btn-sm ${tab === 'rules' ? 'btn-primary' : 'btn-default'}`}>Regras de alerta{rules.length > 0 ? ` (${rules.length})` : ''}</button>
        </div>

        {tab === 'send' ? (
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
                          <span className={`badge ${h.action.endsWith('FAILED') ? 'badge-red' : 'badge-green'}`}>
                            {h.action.endsWith('FAILED') ? 'Falhou' : 'Enviado'}
                          </span>
                          {h.action.startsWith('RULE_') && <span className="badge badge-blue">Regra</span>}
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
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={openNewRule} className="btn btn-primary btn-sm">+ Nova regra</button>
            </div>

            {loading ? (
              <div className="skeleton" style={{ height: 80, borderRadius: 10 }} />
            ) : rules.length === 0 ? (
              <div className="card empty-state" style={{ padding: '24px 16px' }}>
                <p style={{ fontSize: 13 }}>Nenhuma regra configurada ainda.</p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Crie uma regra pra disparar uma mensagem quando um servidor apresentar problema no Zabbix.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rules.map(r => (
                  <div key={r.id} className="card" style={{ padding: 16, opacity: r.active ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                          <span className="badge badge-gray">🖥️ {r.hostName || r.hostId}</span>
                          <span className="badge badge-gray">{TARGET_LABEL[r.targetType] ?? r.targetType}: {r.targetLabel}</span>
                          <span className="badge badge-blue">{MODE_LABEL[r.mode] ?? r.mode}</span>
                          {!r.active && <span className="badge badge-gray">Desativada</span>}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
                          {r.mode === 'AUTOMATIC' ? `Cooldown: ${r.cooldownMinutes} min · ` : ''}
                          Último disparo: {formatDate(r.lastTriggeredAt)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleTriggerRule(r)} disabled={triggeringId === r.id}
                          className="btn btn-primary btn-sm">{triggeringId === r.id ? 'Disparando...' : 'Disparar agora'}</button>
                        <button type="button" onClick={() => handleToggleRule(r)} disabled={togglingId === r.id} className="btn btn-default btn-sm">
                          {r.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button type="button" onClick={() => openEditRule(r)} className="btn btn-default btn-sm">Editar</button>
                        <button type="button" onClick={() => handleDeleteRule(r.id)} disabled={deletingRuleId === r.id} className="btn btn-default btn-sm">
                          {deletingRuleId === r.id ? '...' : 'Remover'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        <Modal open={ruleModalOpen} onClose={() => setRuleModalOpen(false)} title={editingRuleId ? 'Editar regra' : 'Nova regra de alerta'} size="md">
          <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="input-label">Nome da regra</label>
              <input type="text" value={ruleForm.name} onChange={e => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex.: Rede instável — Loja Centro" className="input" />
            </div>

            <div>
              <label className="input-label">Se o servidor</label>
              <select value={ruleForm.hostId} onChange={e => setRuleForm(prev => ({ ...prev, hostId: e.target.value }))} className="input">
                <option value="">Selecione um host do Zabbix...</option>
                {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>apresentar um problema ativo no Zabbix...</p>
            </div>

            <div>
              <label className="input-label">Mensagem a enviar</label>
              <textarea value={ruleForm.message} onChange={e => setRuleForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Escreva a mensagem do zero..." rows={4} className="input resize-none" />
            </div>

            <div>
              <label className="input-label">Para</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" onClick={() => handleRuleFormTargetType('CONTACT')}
                  className={`btn btn-sm ${ruleForm.targetType === 'CONTACT' ? 'btn-primary' : 'btn-default'}`}>👤 Contato</button>
                <button type="button" onClick={() => handleRuleFormTargetType('GROUP')}
                  className={`btn btn-sm ${ruleForm.targetType === 'GROUP' ? 'btn-primary' : 'btn-default'}`}>👥 Grupo</button>
              </div>
              <select value={ruleForm.targetId} onChange={e => setRuleForm(prev => ({ ...prev, targetId: e.target.value }))} className="input">
                <option value="">Selecione...</option>
                {ruleTargets.map(t => (
                  <option key={t.id} value={t.id}>{t.displayName || t.name || t.phoneNumber || t.groupJid}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label">Modo</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setRuleForm(prev => ({ ...prev, mode: 'MANUAL' }))}
                  className={`btn btn-sm ${ruleForm.mode === 'MANUAL' ? 'btn-primary' : 'btn-default'}`}>🖐️ Manual</button>
                <button type="button" onClick={() => setRuleForm(prev => ({ ...prev, mode: 'AUTOMATIC' }))}
                  className={`btn btn-sm ${ruleForm.mode === 'AUTOMATIC' ? 'btn-primary' : 'btn-default'}`}>⚡ Automático</button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {ruleForm.mode === 'MANUAL'
                  ? 'Só dispara quando você clicar em "Disparar agora".'
                  : 'Dispara sozinha quando o servidor tiver um problema ativo no Zabbix, respeitando o cooldown abaixo.'}
              </p>
            </div>

            {ruleForm.mode === 'AUTOMATIC' && (
              <div>
                <label className="input-label">Cooldown entre disparos (minutos)</label>
                <input type="number" min={1} value={ruleForm.cooldownMinutes}
                  onChange={e => setRuleForm(prev => ({ ...prev, cooldownMinutes: e.target.value }))} className="input" style={{ maxWidth: 140 }} />
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Evita reenviar a mesma mensagem repetidamente se o problema piscar (some e volta) no Zabbix.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setRuleModalOpen(false)} className="btn btn-default">Cancelar</button>
              <button type="submit" disabled={savingRule || !ruleForm.name.trim() || !ruleForm.hostId || !ruleForm.targetId || !ruleForm.message.trim()}
                className="btn btn-primary">
                {savingRule ? 'Salvando...' : editingRuleId ? 'Salvar alterações' : 'Criar regra'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  )
}

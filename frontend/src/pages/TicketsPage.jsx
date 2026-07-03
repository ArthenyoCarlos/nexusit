import { useState, useEffect, useCallback } from 'react'
import { getTickets, getTicket, addFollowup, closeTicket, assignTicket } from '../services/glpi'
import { createArticle } from '../services/wiki'
import { buildTicketSummary, buildSuggestedResolution, buildWikiArticleFromTicket, buildWikiLinkFollowup, isPendingResolutionDraft } from '../utils/ticketIntelligence'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const PRIORITY = {
  6: { label: 'Crítica',     bg: 'bg-red-100 text-red-700',       dot: 'bg-red-500'    },
  5: { label: 'Muito Alta',  bg: 'bg-red-50 text-red-600',         dot: 'bg-red-400'    },
  4: { label: 'Alta',        bg: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-500' },
  3: { label: 'Média',       bg: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-500' },
  2: { label: 'Baixa',       bg: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-400'   },
  1: { label: 'Muito Baixa', bg: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400'  },
}
const STATUS_OPTIONS = [
  { value: '',  label: 'Todos os status' },
  { value: '1', label: 'Novo' },
  { value: '2', label: 'Em andamento' },
  { value: '4', label: 'Aguardando' },
  { value: '5', label: 'Resolvido' },
  { value: '6', label: 'Fechado' },
]
const PRIORITY_OPTIONS = [
  { value: '',  label: 'Todas as prioridades' },
  { value: '6', label: 'Crítica' },
  { value: '5', label: 'Muito Alta' },
  { value: '4', label: 'Alta' },
  { value: '3', label: 'Média' },
  { value: '2', label: 'Baixa' },
  { value: '1', label: 'Muito Baixa' },
]
const STATUS_COLOR = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-slate-100 text-slate-600',
  5: 'bg-emerald-100 text-emerald-700',
  6: 'bg-slate-100 text-slate-500',
}

function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] ?? PRIORITY[3]
  return (
    <span className={`badge ${p.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot} inline-block mr-1`} />
      {p.label}
    </span>
  )
}

function StatusBadge({ status, label }) {
  return <span className={`badge ${STATUS_COLOR[status] ?? STATUS_COLOR[1]}`}>{label}</span>
}

function formatDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TicketsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [followupText, setFollowupText] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)
  const [assistantDraft, setAssistantDraft] = useState(null)
  const [wikiCreating, setWikiCreating] = useState(false)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const status = statusFilter ? parseInt(statusFilter) : null
      const res = await getTickets(status)
      setTickets(res.data)
    } catch { setTickets([]) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const openDetail = async (ticket) => {
    setSelected(ticket); setDetail(null); setFollowupText(''); setAssignUserId(''); setActionMsg(null); setAssistantDraft(null)
    setDetailLoading(true)
    try { const res = await getTicket(ticket.id); setDetail(res.data) }
    catch { setDetail(null) }
    finally { setDetailLoading(false) }
  }

  const handleAddFollowup = async () => {
    if (!followupText.trim()) return
    setActionLoading(true)
    try {
      await addFollowup(selected.id, followupText)
      setFollowupText('')
      setActionMsg({ type: 'success', text: 'Resposta adicionada.' })
      const res = await getTicket(selected.id); setDetail(res.data)
    } catch { setActionMsg({ type: 'error', text: 'Erro ao adicionar resposta.' }) }
    finally { setActionLoading(false) }
  }

  const handleClose = async () => {
    if (!window.confirm('Fechar este chamado?')) return
    setActionLoading(true)
    try {
      await closeTicket(selected.id)
      setActionMsg({ type: 'success', text: 'Chamado fechado.' })
      await fetchTickets(); const res = await getTicket(selected.id); setDetail(res.data)
    } catch { setActionMsg({ type: 'error', text: 'Erro ao fechar chamado.' }) }
    finally { setActionLoading(false) }
  }

  const handleAssign = async () => {
    const uid = parseInt(assignUserId); if (!uid) return
    setActionLoading(true)
    try {
      await assignTicket(selected.id, uid)
      setActionMsg({ type: 'success', text: 'Técnico atribuído.' })
      setAssignUserId(''); const res = await getTicket(selected.id); setDetail(res.data)
    } catch { setActionMsg({ type: 'error', text: 'Erro ao atribuir técnico.' }) }
    finally { setActionLoading(false) }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setActionMsg({ type: 'success', text: 'Texto copiado para a área de transferência.' })
    } catch {
      setActionMsg({ type: 'error', text: 'Não foi possível copiar automaticamente. Selecione o texto manualmente.' })
    }
  }

  const handleSmartSummary = () => {
    if (!detail) return
    setAssistantDraft({
      type: 'summary',
      title: 'Resumo do chamado gerado pelo Hermes',
      text: buildTicketSummary(detail),
    })
  }

  const handleSmartResolution = () => {
    if (!detail) return
    const text = buildSuggestedResolution(detail)
    setAssistantDraft({
      type: 'resolution',
      title: 'Resolução sugerida pelo Hermes',
      text,
    })
    setFollowupText(text)
  }

  const handleCreateWikiArticle = async () => {
    if (!detail) return
    const resolution = assistantDraft?.type === 'resolution' ? assistantDraft.text : buildSuggestedResolution(detail)
    const article = buildWikiArticleFromTicket(detail, resolution)
    setWikiCreating(true)
    try {
      const created = await createArticle(article)
      setActionMsg({ type: 'success', text: 'Artigo criado na Wiki.' })
      setAssistantDraft({
        type: 'wiki',
        title: 'Artigo criado na Wiki',
        text: `${created.title}\n\n${window.location.origin}/wiki/${created.id}`,
        url: `/wiki/${created.id}`,
      })
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao criar artigo na Wiki.' })
    } finally {
      setWikiCreating(false)
    }
  }

  const handleCloseAndDocument = async () => {
    if (!detail || !selected) return
    const resolution = followupText.trim() || (assistantDraft?.type === 'resolution' ? assistantDraft.text : buildSuggestedResolution(detail))
    if (isPendingResolutionDraft(resolution)) {
      const proceed = window.confirm('Este chamado ainda parece não ter uma ação técnica registrada. Deseja fechar e documentar mesmo assim?')
      if (!proceed) return
    } else if (!window.confirm('Fechar este chamado e documentar a resolução na Wiki?')) {
      return
    }

    setActionLoading(true)
    setWikiCreating(true)
    try {
      const article = buildWikiArticleFromTicket(detail, resolution)
      const created = await createArticle(article)
      const wikiFollowup = buildWikiLinkFollowup(created, window.location.origin)
      await addFollowup(selected.id, `${resolution}\n\n${wikiFollowup}`)
      await closeTicket(selected.id)
      setFollowupText('')
      setActionMsg({ type: 'success', text: 'Chamado fechado e documentado na Wiki.' })
      setAssistantDraft({
        type: 'wiki',
        title: 'Chamado fechado e documentado',
        text: `${created.title}\n\n${window.location.origin}/wiki/${created.id}`,
        url: `/wiki/${created.id}`,
      })
      await fetchTickets()
      const res = await getTicket(selected.id); setDetail(res.data)
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao fechar e documentar chamado. Verifique se o chamado foi parcialmente atualizado.' })
    } finally {
      setActionLoading(false)
      setWikiCreating(false)
    }
  }

  const filtered = tickets.filter(t => {
    if (priorityFilter && t.priority !== parseInt(priorityFilter)) return false
    if (search) {
      const q = search.toLowerCase()
      return t.title?.toLowerCase().includes(q) || t.requester?.toLowerCase().includes(q) || t.assignedTo?.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <Layout>
      <div className="page">

        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1>Chamados GLPI</h1>
            <p>Integração GLPI {!loading && <span className="badge badge-gray" style={{ marginLeft: 4 }}>{filtered.length}</span>}</p>
          </div>
          <button onClick={fetchTickets} className="btn btn-default">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Atualizar
          </button>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <input type="text" placeholder="Buscar título, solicitante..." value={search}
            onChange={e => setSearch(e.target.value)} className="input" style={{ width: 240, height: 32 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Título</th><th>Prioridade</th><th>Status</th>
                  <th>Solicitante</th><th>Atribuído</th><th>Abertura</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
                      {tickets.length === 0
                        ? 'Nenhum chamado. Verifique a integração com o GLPI.'
                        : 'Nenhum chamado corresponde aos filtros.'}
                    </td>
                  </tr>
                ) : filtered.map(t => (
                  <tr key={t.id} onClick={() => openDetail(t)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{t.id}</td>
                    <td><p style={{ fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 280 }}>{t.title || '(sem título)'}</p></td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td><StatusBadge status={t.status} label={t.statusLabel} /></td>
                    <td className="muted">{t.requester || '—'}</td>
                    <td className="muted">{t.assignedTo || '—'}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{formatDate(t.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setDetail(null) }}
        title={selected ? `Chamado #${selected.id}` : ''} size="xl">
        {detailLoading && (
          <div className="space-y-3 py-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-4 w-full" />)}
          </div>
        )}
        {detail && (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">{detail.ticket.title}</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <PriorityBadge priority={detail.ticket.priority} />
                <StatusBadge status={detail.ticket.status} label={detail.ticket.statusLabel} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                <div><span className="text-slate-400 text-xs block">Solicitante</span>{detail.ticket.requester || '—'}</div>
                <div><span className="text-slate-400 text-xs block">Atribuído</span>{detail.ticket.assignedTo || '—'}</div>
                <div><span className="text-slate-400 text-xs block">Abertura</span>{formatDate(detail.ticket.openedAt)}</div>
                {detail.ticket.solvedAt && (
                  <div><span className="text-slate-400 text-xs block">Resolução</span>{formatDate(detail.ticket.solvedAt)}</div>
                )}
              </div>
            </div>

            {detail.content && (
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 whitespace-pre-wrap border border-slate-200">
                {detail.content}
              </div>
            )}

            {/* Hermes Actions */}
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Hermes no chamado</p>
                  <p className="text-sm text-slate-600">Gere resumo, resolução base ou artigo da Wiki a partir do histórico do GLPI.</p>
                </div>
                <span className="badge bg-indigo-100 text-indigo-700">NexusAI</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleSmartSummary} disabled={actionLoading || wikiCreating}
                  className="btn btn-default text-xs">
                  Gerar resumo
                </button>
                <button onClick={handleSmartResolution} disabled={actionLoading || wikiCreating}
                  className="btn btn-primary text-xs">
                  Gerar resolução
                </button>
                <button onClick={handleCreateWikiArticle} disabled={actionLoading || wikiCreating}
                  className="btn btn-default text-xs">
                  {wikiCreating ? 'Criando...' : 'Documentar na Wiki'}
                </button>
                {isAdmin && (
                  <button onClick={handleCloseAndDocument} disabled={actionLoading || wikiCreating || detail.ticket.status === 6}
                    className="btn btn-primary text-xs">
                    {actionLoading || wikiCreating ? 'Processando...' : 'Fechar e documentar'}
                  </button>
                )}
              </div>
              {assistantDraft && (
                <div className="mt-4 rounded-xl bg-white border border-indigo-100 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{assistantDraft.title}</p>
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(assistantDraft.text)} className="btn btn-default text-xs">Copiar</button>
                      {assistantDraft.url && <a href={assistantDraft.url} className="btn btn-primary text-xs" target="_blank" rel="noreferrer">Abrir Wiki</a>}
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{assistantDraft.text}</pre>
                </div>
              )}
            </div>

            {/* Followups */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Histórico ({detail.followups.length})
              </p>
              {detail.followups.length === 0 ? (
                <p className="text-slate-400 text-sm italic">Nenhum acompanhamento ainda.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {detail.followups.map(f => (
                    <div key={f.id} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span className="font-medium text-slate-700">{f.author || 'Sistema'}</span>
                        <span>{formatDate(f.date)}</span>
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{f.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {actionMsg && (
              <div className={`text-sm px-3 py-2.5 rounded-lg ${
                actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>{actionMsg.text}</div>
            )}

            {/* Add Followup */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Adicionar resposta</p>
              <textarea value={followupText} onChange={e => setFollowupText(e.target.value)}
                placeholder="Digite sua resposta..." rows={3}
                className="input resize-none" />
              <div className="flex justify-end mt-2">
                <button onClick={handleAddFollowup} disabled={!followupText.trim() || actionLoading}
                  className="btn btn-primary text-xs">
                  Enviar resposta
                </button>
              </div>
            </div>

            {isAdmin && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ações de Admin</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleClose} disabled={actionLoading || detail.ticket.status === 6}
                    className="btn btn-default text-xs">
                    Fechar chamado
                  </button>
                  <input type="number" placeholder="ID do técnico (GLPI)" value={assignUserId}
                    onChange={e => setAssignUserId(e.target.value)}
                    className="input w-44 text-xs" />
                  <button onClick={handleAssign} disabled={!assignUserId || actionLoading}
                    className="btn btn-primary text-xs">
                    Atribuir técnico
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  )
}

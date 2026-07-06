import { useState, useEffect, useCallback } from 'react'
import { getTickets, getTicket, addFollowup, closeTicket, assignTicket, getTechnicians } from '../services/glpi'
import { createArticle, searchWiki } from '../services/wiki'
import { getTicketWikiLinks, createTicketWikiLink } from '../services/ticketWikiLinks'
import { buildTicketSummary, buildSuggestedResolution, buildWikiArticleFromTicket, buildWikiLinkFollowup, isPendingResolutionDraft, buildWikiSearchQueries, mergeWikiSuggestions, shouldWarnBeforeCreatingWikiArticle, detectDuplicateTicketGroups, findDuplicateTicketsFor } from '../utils/ticketIntelligence'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const PRIORITY = {
  6: { label: 'Crítica',     bg: 'bg-[var(--red-bg)] text-[var(--red)]',       dot: 'bg-[var(--red)]'    },
  5: { label: 'Muito Alta',  bg: 'bg-[var(--red-bg)] text-[var(--red)]',       dot: 'bg-[var(--red)]'    },
  4: { label: 'Alta',        bg: 'bg-[var(--orange-bg)] text-[var(--orange)]', dot: 'bg-[var(--orange)]' },
  3: { label: 'Média',       bg: 'bg-[var(--amber-bg)] text-[var(--amber)]',   dot: 'bg-[var(--amber)]'  },
  2: { label: 'Baixa',       bg: 'bg-[var(--accent-light)] text-[var(--accent-text)]', dot: 'bg-[var(--accent)]' },
  1: { label: 'Muito Baixa', bg: 'bg-[var(--bg-muted)] text-[var(--text-secondary)]',  dot: 'bg-[var(--text-tertiary)]'  },
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
  1: 'bg-[var(--accent-light)] text-[var(--accent-text)]',
  2: 'bg-[var(--amber-bg)] text-[var(--amber)]',
  3: 'bg-[var(--amber-bg)] text-[var(--amber)]',
  4: 'bg-[var(--bg-muted)] text-[var(--text-secondary)]',
  5: 'bg-[var(--green-bg)] text-[var(--green)]',
  6: 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]',
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

function describeGlpiError(err, fallback) {
  const detail = err?.response?.data?.error
  return detail ? `${fallback} (${detail})` : fallback
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
  const [wikiLinks, setWikiLinks] = useState([])
  const [wikiSuggestions, setWikiSuggestions] = useState([])
  const [wikiSuggestionQueries, setWikiSuggestionQueries] = useState([])
  const [wikiSuggestionsLoading, setWikiSuggestionsLoading] = useState(false)
  const [technicians, setTechnicians] = useState([])

  useEffect(() => {
    if (!isAdmin) return
    getTechnicians().then(res => setTechnicians(res.data)).catch(() => setTechnicians([]))
  }, [isAdmin])

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

  const loadWikiSuggestions = async (ticketDetail, links = []) => {
    const queries = buildWikiSearchQueries(ticketDetail)
    setWikiSuggestionQueries(queries)
    setWikiSuggestions([])
    if (queries.length === 0) return

    setWikiSuggestionsLoading(true)
    try {
      const groups = await Promise.all(queries.map(q => searchWiki(q).catch(() => [])))
      const linkedIds = new Set((links || []).map(link => link.wikiArticleId))
      setWikiSuggestions(mergeWikiSuggestions(groups, { detail: ticketDetail, queries }).filter(article => !linkedIds.has(article.id)))
    } catch {
      setWikiSuggestions([])
    } finally {
      setWikiSuggestionsLoading(false)
    }
  }

  const openDetail = async (ticket) => {
    setSelected(ticket); setDetail(null); setFollowupText(''); setAssignUserId(''); setActionMsg(null); setAssistantDraft(null); setWikiLinks([]); setWikiSuggestions([]); setWikiSuggestionQueries([])
    setDetailLoading(true)
    try {
      const [ticketRes, links] = await Promise.all([
        getTicket(ticket.id),
        getTicketWikiLinks(ticket.id).catch(() => []),
      ])
      setDetail(ticketRes.data)
      setWikiLinks(links)
      loadWikiSuggestions(ticketRes.data, links)
    }
    catch { setDetail(null); setWikiLinks([]); setWikiSuggestions([]) }
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
    } catch (err) { setActionMsg({ type: 'error', text: describeGlpiError(err, 'Erro ao adicionar resposta.') }) }
    finally { setActionLoading(false) }
  }

  const handleClose = async () => {
    if (!window.confirm('Fechar este chamado?')) return
    setActionLoading(true)
    try {
      await closeTicket(selected.id)
      setActionMsg({ type: 'success', text: 'Chamado fechado.' })
      await fetchTickets(); const res = await getTicket(selected.id); setDetail(res.data)
    } catch (err) { setActionMsg({ type: 'error', text: describeGlpiError(err, 'Erro ao fechar chamado.') }) }
    finally { setActionLoading(false) }
  }

  const handleAssign = async () => {
    const uid = parseInt(assignUserId); if (!uid) return
    setActionLoading(true)
    try {
      await assignTicket(selected.id, uid)
      setActionMsg({ type: 'success', text: 'Técnico atribuído.' })
      setAssignUserId(''); const res = await getTicket(selected.id); setDetail(res.data)
    } catch (err) { setActionMsg({ type: 'error', text: describeGlpiError(err, 'Erro ao atribuir técnico.') }) }
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
    if (selectedDuplicates.length > 0) {
      const proceed = window.confirm(`Este chamado possui ${selectedDuplicates.length} possível(is) duplicado(s). Deseja documentar apenas este chamado mesmo assim?`)
      if (!proceed) return
    }
    if (shouldWarnBeforeCreatingWikiArticle(wikiSuggestions)) {
      const proceed = window.confirm(`Encontramos ${wikiSuggestions.length} artigo(s) parecido(s) na Wiki. Deseja criar um novo artigo mesmo assim?`)
      if (!proceed) return
    }
    const resolution = assistantDraft?.type === 'resolution' ? assistantDraft.text : buildSuggestedResolution(detail)
    const article = buildWikiArticleFromTicket(detail, resolution)
    setWikiCreating(true)
    try {
      const created = await createArticle(article)
      const link = await createTicketWikiLink({ glpiTicketId: selected.id, wikiArticleId: created.id }).catch(() => null)
      if (link) {
        setWikiLinks(prev => [link, ...prev.filter(x => x.id !== link.id)])
        setWikiSuggestions(prev => prev.filter(article => article.id !== link.wikiArticleId))
      }
      setActionMsg({ type: 'success', text: 'Artigo criado na Wiki e vinculado ao chamado.' })
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

  const handleLinkExistingArticle = async (article) => {
    if (!selected || !article?.id) return
    setActionLoading(true)
    try {
      const link = await createTicketWikiLink({ glpiTicketId: selected.id, wikiArticleId: article.id })
      setWikiLinks(prev => [link, ...prev.filter(x => x.id !== link.id)])
      setWikiSuggestions(prev => prev.filter(item => item.id !== article.id))
      setActionMsg({ type: 'success', text: 'Artigo existente vinculado ao chamado.' })
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao vincular artigo existente ao chamado.' })
    } finally {
      setActionLoading(false)
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
    if (selectedDuplicates.length > 0) {
      const proceed = window.confirm(`Este chamado possui ${selectedDuplicates.length} possível(is) duplicado(s). Deseja fechar e documentar apenas este chamado mesmo assim?`)
      if (!proceed) return
    }
    if (shouldWarnBeforeCreatingWikiArticle(wikiSuggestions)) {
      const proceed = window.confirm(`Encontramos ${wikiSuggestions.length} artigo(s) parecido(s) na Wiki. Deseja criar um novo artigo mesmo assim?`)
      if (!proceed) return
    }

    setActionLoading(true)
    setWikiCreating(true)
    try {
      const article = buildWikiArticleFromTicket(detail, resolution)
      const created = await createArticle(article)
      const link = await createTicketWikiLink({ glpiTicketId: selected.id, wikiArticleId: created.id }).catch(() => null)
      if (link) {
        setWikiLinks(prev => [link, ...prev.filter(x => x.id !== link.id)])
        setWikiSuggestions(prev => prev.filter(article => article.id !== link.wikiArticleId))
      }
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

  const duplicateGroups = detectDuplicateTicketGroups(tickets)
  const duplicateCountsById = new Map(duplicateGroups.flatMap(group => group.tickets.map(ticket => [ticket.id, group.count])))
  const selectedDuplicates = selected ? findDuplicateTicketsFor(selected, tickets) : []

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
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360 }}>
                        <p style={{ fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 280 }}>{t.title || '(sem título)'}</p>
                        {duplicateCountsById.has(t.id) && <span className="badge bg-[var(--amber-bg)] text-[var(--amber)]">duplicado x{duplicateCountsById.get(t.id)}</span>}
                      </div>
                    </td>
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
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">{detail.ticket.title}</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <PriorityBadge priority={detail.ticket.priority} />
                <StatusBadge status={detail.ticket.status} label={detail.ticket.statusLabel} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[var(--text-secondary)]">
                <div><span className="text-[var(--text-tertiary)] text-xs block">Solicitante</span>{detail.ticket.requester || '—'}</div>
                <div><span className="text-[var(--text-tertiary)] text-xs block">Atribuído</span>{detail.ticket.assignedTo || '—'}</div>
                <div><span className="text-[var(--text-tertiary)] text-xs block">Abertura</span>{formatDate(detail.ticket.openedAt)}</div>
                {detail.ticket.solvedAt && (
                  <div><span className="text-[var(--text-tertiary)] text-xs block">Resolução</span>{formatDate(detail.ticket.solvedAt)}</div>
                )}
              </div>
            </div>

            {detail.content && (
              <div className="bg-[var(--bg-subtle)] rounded-xl p-4 text-sm text-[var(--text-secondary)] whitespace-pre-wrap border border-[var(--border)]">
                {detail.content}
              </div>
            )}

            {selectedDuplicates.length > 0 && (
              <div className="rounded-2xl border border-[var(--amber-border)] bg-[var(--amber-bg)] p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--amber)] uppercase tracking-wider">Possíveis chamados duplicados</p>
                    <p className="text-sm text-[var(--amber)]">Encontramos chamados abertos com mesmo assunto e solicitante. Revise antes de documentar ou fechar individualmente.</p>
                  </div>
                  <span className="badge bg-[var(--amber-bg)] text-[var(--amber)]">{selectedDuplicates.length + 1} similares</span>
                </div>
                <div className="space-y-2">
                  {selectedDuplicates.map(ticket => (
                    <button key={ticket.id} onClick={() => openDetail(ticket)}
                      className="w-full text-left rounded-xl border border-[var(--amber-border)] bg-[var(--bg-surface)] p-3 hover:bg-[var(--amber-bg)] transition">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">#{ticket.id} · {ticket.title || '(sem título)'}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{ticket.requester || '—'} · {ticket.statusLabel || 'Status não informado'} · {formatDate(ticket.openedAt)}</p>
                        </div>
                        <span className="text-xs font-semibold text-[var(--amber)]">Abrir</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hermes Actions */}
            <div className="rounded-2xl border border-[var(--accent-ring)] bg-[var(--accent-light)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-semibold text-[var(--accent-text)] uppercase tracking-wider">Hermes no chamado</p>
                  <p className="text-sm text-[var(--text-secondary)]">Gere resumo, resolução base ou artigo da Wiki a partir do histórico do GLPI.</p>
                </div>
                <span className="badge badge-blue">NexusAI</span>
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
                <div className="mt-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--accent-ring)] p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{assistantDraft.title}</p>
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(assistantDraft.text)} className="btn btn-default text-xs">Copiar</button>
                      {assistantDraft.url && <a href={assistantDraft.url} className="btn btn-primary text-xs" target="_blank" rel="noreferrer">Abrir Wiki</a>}
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-[var(--text-secondary)] font-sans leading-relaxed">{assistantDraft.text}</pre>
                </div>
              )}
            </div>

            {/* Wiki Suggestions */}
            <div className="rounded-2xl border border-[var(--amber-border)] bg-[var(--amber-bg)] p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs font-semibold text-[var(--amber)] uppercase tracking-wider">Sugestões da Wiki</p>
                  <p className="text-sm text-[var(--text-secondary)]">Artigos parecidos encontrados automaticamente antes de documentar.</p>
                </div>
                <span className="badge bg-[var(--amber-bg)] text-[var(--amber)]">{wikiSuggestionsLoading ? 'buscando' : wikiSuggestions.length}</span>
              </div>
              {wikiSuggestionQueries.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {wikiSuggestionQueries.map(q => <span key={q} className="badge bg-[var(--bg-surface)] text-[var(--text-tertiary)] border border-[var(--amber-border)]">{q}</span>)}
                </div>
              )}
              {!wikiSuggestionsLoading && wikiSuggestions.length > 0 && (
                <div className="mb-3 rounded-xl border border-[var(--amber-border)] bg-[var(--amber-bg)] px-3 py-2 text-sm text-[var(--amber)]">
                  Possível duplicidade: revise as sugestões ou vincule um artigo existente antes de criar nova documentação.
                </div>
              )}
              {wikiSuggestionsLoading ? (
                <p className="text-sm text-[var(--text-tertiary)] italic">Buscando artigos relacionados...</p>
              ) : wikiSuggestions.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] italic">Nenhum artigo parecido encontrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {wikiSuggestions.map(article => (
                    <div key={article.id} className="rounded-xl border border-[var(--amber-border)] bg-[var(--bg-surface)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{article.title}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{article.category || 'Wiki'} · score {article.score || 0} · {article.matchCount} ocorrência(s) nas buscas</p>
                          {article.scoreReasons?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {article.scoreReasons.map(reason => <span key={reason} className="badge bg-[var(--amber-bg)] text-[var(--amber)] border border-[var(--amber-border)]">{reason}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <a href={`/wiki/${article.id}`} target="_blank" rel="noreferrer" className="btn btn-default text-xs">Abrir</a>
                          <button onClick={() => handleLinkExistingArticle(article)} disabled={actionLoading}
                            className="btn btn-primary text-xs">Vincular ao chamado</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Wiki Articles */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Artigos relacionados na Wiki</p>
                <span className="badge bg-[var(--bg-muted)] text-[var(--text-secondary)]">{wikiLinks.length}</span>
              </div>
              {wikiLinks.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] italic">Nenhum artigo vinculado a este chamado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {wikiLinks.map(link => (
                    <a key={link.id} href={`/wiki/${link.wikiArticleId}`} target="_blank" rel="noreferrer"
                      className="block rounded-xl border border-[var(--border-muted)] p-3 hover:bg-[var(--bg-subtle)] transition">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{link.wikiTitle}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{link.wikiCategory || 'Wiki'} · criado por {link.createdByName || 'Sistema'}</p>
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap">{formatDate(link.createdAt)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Followups */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                Histórico ({detail.followups.length})
              </p>
              {detail.followups.length === 0 ? (
                <p className="text-[var(--text-tertiary)] text-sm italic">Nenhum acompanhamento ainda.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {detail.followups.map(f => (
                    <div key={f.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-3">
                      <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                        <span className="font-medium text-[var(--text-secondary)]">{f.author || 'Sistema'}</span>
                        <span>{formatDate(f.date)}</span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{f.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {actionMsg && (
              <div className={`alert ${actionMsg.type === 'success' ? 'alert-green' : 'alert-red'}`}>{actionMsg.text}</div>
            )}

            {/* Add Followup */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Adicionar resposta</p>
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
              <div className="border-t border-[var(--border-muted)] pt-4">
                <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Ações de Admin</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleClose} disabled={actionLoading || detail.ticket.status === 6}
                    className="btn btn-default text-xs">
                    Fechar chamado
                  </button>
                  <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                    className="input w-56 text-xs">
                    <option value="">Selecione um técnico...</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
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

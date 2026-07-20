import { useState, useEffect, useCallback } from 'react'
import { getTickets, getTicket, addFollowup, closeTicket, assignTicket, getTechnicians, getCategories, createCategory, updateTicketFields } from '../services/glpi'
import { createArticle, searchWiki } from '../services/wiki'
import { getTicketWikiLinks, createTicketWikiLink } from '../services/ticketWikiLinks'
import { getTicketAssetLinks, createTicketAssetLink, deleteTicketAssetLink } from '../services/ticketAssetLinks'
import { getSystems } from '../services/systems'
import { getInventory } from '../services/inventory'
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
  { value: 'OPEN', label: 'Abertos' },
  { value: 'CLOSED', label: 'Fechados/Resolvidos' },
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
const URGENCY_IMPACT_OPTIONS = [
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
const ORIGIN = {
  ZABBIX:   { label: 'Zabbix',        icon: '🖥️', badge: 'badge-orange', color: 'var(--orange)', bg: 'var(--orange-bg)' },
  WHATSAPP: { label: 'WhatsApp (CRM)', icon: '💬', badge: 'badge-green',  color: 'var(--green)',  bg: 'var(--green-bg)'  },
  MANUAL:   { label: 'Manual/GLPI',   icon: '📋', badge: 'badge-gray',   color: 'var(--text-secondary)', bg: 'var(--bg-muted)' },
}
const ORIGIN_OPTIONS = [
  { value: '', label: 'Todas as origens' },
  { value: 'ZABBIX', label: 'Zabbix' },
  { value: 'WHATSAPP', label: 'WhatsApp (CRM)' },
  { value: 'MANUAL', label: 'Manual/GLPI' },
]

function OriginBadge({ origin }) {
  const o = ORIGIN[origin] ?? ORIGIN.MANUAL
  return <span className={`badge ${o.badge}`}>{o.icon} {o.label}</span>
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

const SECTION_TONE = {
  neutral: { bg: 'var(--bg-muted)', color: 'var(--text-secondary)' },
  accent:  { bg: 'var(--accent-light)', color: 'var(--accent-text)' },
  amber:   { bg: 'var(--amber-bg)', color: 'var(--amber)' },
}

function TicketSection({ icon, title, subtitle, tone = 'neutral', right, children }) {
  const t = SECTION_TONE[tone] ?? SECTION_TONE.neutral
  return (
    <section className="ticket-section">
      <div className="ticket-section-head">
        <div className="ticket-section-head-left">
          <span className="ticket-section-icon" style={{ background: t.bg, color: t.color }}>{icon}</span>
          <div style={{ minWidth: 0 }}>
            <p className="ticket-section-title">{title}</p>
            {subtitle && <p className="ticket-section-subtitle">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="ticket-section-right">{right}</div>}
      </div>
      <div className="ticket-section-body">{children}</div>
    </section>
  )
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

export default function TicketsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [originFilter, setOriginFilter] = useState('')
  const [requesterFilter, setRequesterFilter] = useState('')
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
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
  const [assetLinks, setAssetLinks] = useState([])
  const [systemsList, setSystemsList] = useState([])
  const [inventoryList, setInventoryList] = useState([])
  const [assetPickerType, setAssetPickerType] = useState('SYSTEM')
  const [assetPickerId, setAssetPickerId] = useState('')
  const [assetLinking, setAssetLinking] = useState(false)
  const [categories, setCategories] = useState([])
  const [editTitle, setEditTitle] = useState('')
  const [titleLoading, setTitleLoading] = useState(false)
  const [editCategory, setEditCategory] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryCreating, setCategoryCreating] = useState(false)
  const [editPriority, setEditPriority] = useState('')
  const [editUrgency, setEditUrgency] = useState('')
  const [editImpact, setEditImpact] = useState('')
  const [classifyLoading, setClassifyLoading] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    getTechnicians().then(res => setTechnicians(res.data)).catch(() => setTechnicians([]))
  }, [isAdmin])

  useEffect(() => {
    getCategories().then(res => setCategories(res.data)).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!detail) return
    setEditTitle(detail.ticket.title || '')
    setEditPriority(String(detail.ticket.priority || ''))
    setEditUrgency(String(detail.ticket.urgency || ''))
    setEditImpact(String(detail.ticket.impact || ''))
    const match = categories.find(c => c.name === detail.ticket.category)
    setEditCategory(match ? String(match.id) : '')
  }, [detail, categories])

  useEffect(() => {
    getSystems().then(setSystemsList).catch(() => setSystemsList([]))
    getInventory().then(setInventoryList).catch(() => setInventoryList([]))
  }, [])

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTickets()
      setTickets(res.data)
    } catch { setTickets([]) }
    finally { setLoading(false) }
  }, [])

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
    setSelected(ticket); setDetail(null); setFollowupText(''); setAssignUserId(''); setActionMsg(null); setAssistantDraft(null); setWikiLinks([]); setWikiSuggestions([]); setWikiSuggestionQueries([]); setAssetLinks([]); setAssetPickerId('')
    setDetailLoading(true)
    try {
      const [ticketRes, links, assets] = await Promise.all([
        getTicket(ticket.id),
        getTicketWikiLinks(ticket.id).catch(() => []),
        getTicketAssetLinks(ticket.id).catch(() => []),
      ])
      setDetail(ticketRes.data)
      setWikiLinks(links)
      setAssetLinks(assets)
      loadWikiSuggestions(ticketRes.data, links)
    }
    catch { setDetail(null); setWikiLinks([]); setWikiSuggestions([]); setAssetLinks([]) }
    finally { setDetailLoading(false) }
  }

  const handleLinkAsset = async () => {
    if (!assetPickerId || !selected) return
    setAssetLinking(true)
    try {
      const link = await createTicketAssetLink({ glpiTicketId: selected.id, assetType: assetPickerType, assetId: assetPickerId })
      setAssetLinks(prev => [link, ...prev.filter(l => l.id !== link.id)])
      setAssetPickerId('')
      setActionMsg({ type: 'success', text: 'Sistema/ativo vinculado ao chamado.' })
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao vincular sistema/ativo ao chamado.' })
    } finally {
      setAssetLinking(false)
    }
  }

  const handleUnlinkAsset = async (id) => {
    try {
      await deleteTicketAssetLink(id)
      setAssetLinks(prev => prev.filter(l => l.id !== id))
    } catch {
      setActionMsg({ type: 'error', text: 'Erro ao remover vínculo.' })
    }
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

  const handleUpdateTitle = async () => {
    if (!selected || !editTitle.trim()) return
    setTitleLoading(true)
    try {
      await updateTicketFields(selected.id, { name: editTitle.trim() })
      setActionMsg({ type: 'success', text: 'Assunto do chamado atualizado.' })
      await fetchTickets(); const res = await getTicket(selected.id); setDetail(res.data); setSelected(res.data.ticket)
    } catch (err) { setActionMsg({ type: 'error', text: describeGlpiError(err, 'Erro ao atualizar assunto.') }) }
    finally { setTitleLoading(false) }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setCategoryCreating(true)
    try {
      const res = await createCategory(newCategoryName.trim())
      const created = res.data
      const updated = await getCategories().then(r => r.data).catch(() => [...categories, created])
      setCategories(updated)
      setEditCategory(String(created.id))
      setNewCategoryName('')
      setActionMsg({ type: 'success', text: 'Setor criado. Clique em Salvar classificação para aplicar ao chamado.' })
    } catch (err) { setActionMsg({ type: 'error', text: describeGlpiError(err, 'Erro ao criar setor.') }) }
    finally { setCategoryCreating(false) }
  }

  const handleUpdateClassification = async () => {
    if (!selected) return
    setClassifyLoading(true)
    try {
      const fields = {}
      fields.itilcategories_id = editCategory ? parseInt(editCategory) : 0
      if (editPriority) fields.priority = parseInt(editPriority)
      if (editUrgency) fields.urgency = parseInt(editUrgency)
      if (editImpact) fields.impact = parseInt(editImpact)
      await updateTicketFields(selected.id, fields)
      setActionMsg({ type: 'success', text: 'Classificação do chamado atualizada.' })
      await fetchTickets(); const res = await getTicket(selected.id); setDetail(res.data)
    } catch (err) { setActionMsg({ type: 'error', text: describeGlpiError(err, 'Erro ao atualizar classificação.') }) }
    finally { setClassifyLoading(false) }
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
    if (statusFilter === 'OPEN' && ![1, 2, 3, 4].includes(t.status)) return false
    if (statusFilter === 'CLOSED' && ![5, 6].includes(t.status)) return false
    if (statusFilter && !['OPEN', 'CLOSED'].includes(statusFilter) && t.status !== parseInt(statusFilter)) return false
    if (priorityFilter && t.priority !== parseInt(priorityFilter)) return false
    if (originFilter && (t.origin || 'MANUAL') !== originFilter) return false
    if (requesterFilter && (t.requester || '') !== requesterFilter) return false
    if (technicianFilter && (t.assignedTo || '') !== technicianFilter) return false
    if (sectorFilter && (t.category || '') !== sectorFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return t.title?.toLowerCase().includes(q) || t.requester?.toLowerCase().includes(q) || t.assignedTo?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q)
    }
    return true
  })

  const requesterOptions = Array.from(new Set(tickets.map(t => t.requester).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const technicianOptions = Array.from(new Set(tickets.map(t => t.assignedTo).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const sectorOptions = Array.from(new Set(tickets.map(t => t.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const duplicateGroups = detectDuplicateTicketGroups(tickets)
  const duplicateCountsById = new Map(duplicateGroups.flatMap(group => group.tickets.map(ticket => [ticket.id, group.count])))
  const selectedDuplicates = selected ? findDuplicateTicketsFor(selected, tickets) : []

  const originCounts = tickets.reduce((acc, t) => {
    const key = t.origin || 'MANUAL'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

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

        {/* Origin KPIs */}
        <div className="ticket-origin-kpis">
          <div className="stat-card ticket-origin-kpi">
            <div className="stat-icon" style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>📊</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">{loading ? '—' : tickets.length}</div>
              <div className="stat-label">Total carregado</div>
            </div>
          </div>
          <button type="button" className="stat-card ticket-origin-kpi ticket-origin-kpi-btn"
            onClick={() => setOriginFilter(originFilter === 'ZABBIX' ? '' : 'ZABBIX')}
            style={{ borderColor: originFilter === 'ZABBIX' ? 'var(--orange)' : undefined }}>
            <div className="stat-icon" style={{ background: ORIGIN.ZABBIX.bg, color: ORIGIN.ZABBIX.color }}>{ORIGIN.ZABBIX.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">{loading ? '—' : originCounts.ZABBIX || 0}</div>
              <div className="stat-label">Zabbix (monitoramento)</div>
            </div>
          </button>
          <button type="button" className="stat-card ticket-origin-kpi ticket-origin-kpi-btn"
            onClick={() => setOriginFilter(originFilter === 'WHATSAPP' ? '' : 'WHATSAPP')}
            style={{ borderColor: originFilter === 'WHATSAPP' ? 'var(--green)' : undefined }}>
            <div className="stat-icon" style={{ background: ORIGIN.WHATSAPP.bg, color: ORIGIN.WHATSAPP.color }}>{ORIGIN.WHATSAPP.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">{loading ? '—' : originCounts.WHATSAPP || 0}</div>
              <div className="stat-label">WhatsApp (CRM/Hermes)</div>
            </div>
          </button>
          <button type="button" className="stat-card ticket-origin-kpi ticket-origin-kpi-btn"
            onClick={() => setOriginFilter(originFilter === 'MANUAL' ? '' : 'MANUAL')}
            style={{ borderColor: originFilter === 'MANUAL' ? 'var(--border-strong)' : undefined }}>
            <div className="stat-icon" style={{ background: ORIGIN.MANUAL.bg, color: ORIGIN.MANUAL.color }}>{ORIGIN.MANUAL.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stat-value">{loading ? '—' : originCounts.MANUAL || 0}</div>
              <div className="stat-label">Manual / GLPI</div>
            </div>
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
          <select value={originFilter} onChange={e => setOriginFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            {ORIGIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={requesterFilter} onChange={e => setRequesterFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os usuários</option>
            {requesterOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={technicianFilter} onChange={e => setTechnicianFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os técnicos</option>
            {technicianOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os setores</option>
            {sectorOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Título</th><th>Origem</th><th>Prioridade</th><th>Status</th>
                  <th>Solicitante</th><th>Atribuído</th><th>Abertura</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
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
                    <td><OriginBadge origin={t.origin} /></td>
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
          <div className="ticket-detail-body">
            <div>
              <div className="ticket-detail-header-top">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label className="input-label">Assunto do chamado</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input" placeholder="Assunto do chamado" />
                    <button onClick={handleUpdateTitle} disabled={titleLoading || !editTitle.trim()} className="btn btn-primary text-xs">
                      {titleLoading ? 'Salvando...' : 'Salvar assunto'}
                    </button>
                  </div>
                </div>
                <div className="ticket-detail-header-badges">
                  <PriorityBadge priority={detail.ticket.priority} />
                  <StatusBadge status={detail.ticket.status} label={detail.ticket.statusLabel} />
                </div>
              </div>
              <div className="ticket-detail-meta-row">
                <div className="ticket-detail-meta-item">
                  <span className="ticket-detail-meta-label">Origem</span>
                  <span className="ticket-detail-meta-value"><OriginBadge origin={detail.ticket.origin} /></span>
                </div>
                <div className="ticket-detail-meta-item">
                  <span className="ticket-detail-meta-label">Solicitante</span>
                  <span className="ticket-detail-meta-value">{detail.ticket.requester || '—'}</span>
                </div>
                <div className="ticket-detail-meta-item">
                  <span className="ticket-detail-meta-label">Atribuído</span>
                  <span className="ticket-detail-meta-value">{detail.ticket.assignedTo || '—'}</span>
                </div>
                <div className="ticket-detail-meta-item">
                  <span className="ticket-detail-meta-label">Abertura</span>
                  <span className="ticket-detail-meta-value">{formatDate(detail.ticket.openedAt)}</span>
                </div>
                {detail.ticket.solvedAt && (
                  <div className="ticket-detail-meta-item">
                    <span className="ticket-detail-meta-label">Resolução</span>
                    <span className="ticket-detail-meta-value">{formatDate(detail.ticket.solvedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {detail.content && (
              <TicketSection icon="📝" title="Descrição" tone="neutral">
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap" style={{ margin: 0, lineHeight: 1.6 }}>{detail.content}</p>
              </TicketSection>
            )}

            {/* Classification: category / priority / urgency / impact */}
            <TicketSection icon="🏷️" title="Setor e classificação" tone="neutral"
              right={
                <button onClick={handleUpdateClassification} disabled={classifyLoading} className="btn btn-primary text-xs">
                  {classifyLoading ? 'Salvando...' : 'Salvar classificação'}
                </button>
              }>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div>
                  <label className="input-label">Setor</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="input text-xs">
                    <option value="">Sem setor</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Prioridade</label>
                  <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="input text-xs">
                    {PRIORITY_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Urgência</label>
                  <select value={editUrgency} onChange={e => setEditUrgency(e.target.value)} className="input text-xs">
                    {URGENCY_IMPACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Impacto</label>
                  <select value={editImpact} onChange={e => setEditImpact(e.target.value)} className="input text-xs">
                    {URGENCY_IMPACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'end', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 240, flex: 1 }}>
                  <label className="input-label">Criar novo setor</label>
                  <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="input text-xs" placeholder="Ex.: Financeiro, Comercial, Logística" />
                </div>
                <button onClick={handleCreateCategory} disabled={categoryCreating || !newCategoryName.trim()} className="btn btn-default text-xs">
                  {categoryCreating ? 'Criando...' : 'Criar setor'}
                </button>
              </div>
            </TicketSection>

            {selectedDuplicates.length > 0 && (
              <TicketSection icon="⚠️" title="Possíveis chamados duplicados" tone="amber"
                subtitle="Encontramos chamados abertos com mesmo assunto e solicitante. Revise antes de documentar ou fechar individualmente."
                right={<span className="badge badge-amber">{selectedDuplicates.length + 1} similares</span>}>
                <div className="space-y-2">
                  {selectedDuplicates.map(ticket => (
                    <button key={ticket.id} onClick={() => openDetail(ticket)}
                      className="w-full text-left rounded-xl border border-[var(--amber-border)] bg-[var(--bg-subtle)] p-3 hover:bg-[var(--amber-bg)] transition">
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
              </TicketSection>
            )}

            {/* Hermes Actions */}
            <TicketSection icon="✨" title="Hermes no chamado" tone="accent"
              subtitle="Gere resumo, resolução base ou artigo da Wiki a partir do histórico do GLPI."
              right={<span className="badge badge-blue">NexusAI</span>}>
              <div className="flex flex-wrap" style={{ gap: 10 }}>
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
                <div className="mt-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--accent-ring)] p-3">
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
            </TicketSection>

            {/* Wiki Suggestions */}
            <TicketSection icon="📚" title="Sugestões da Wiki" tone="amber"
              subtitle="Artigos parecidos encontrados automaticamente antes de documentar."
              right={<span className="badge badge-amber">{wikiSuggestionsLoading ? 'buscando' : wikiSuggestions.length}</span>}>
              {wikiSuggestionQueries.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {wikiSuggestionQueries.map(q => <span key={q} className="badge bg-[var(--bg-subtle)] text-[var(--text-tertiary)] border border-[var(--border-muted)]">{q}</span>)}
                </div>
              )}
              {!wikiSuggestionsLoading && wikiSuggestions.length > 0 && (
                <div className="alert alert-amber mb-3">
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
                    <div key={article.id} className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-subtle)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{article.title}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{article.category || 'Wiki'} · score {article.score || 0} · {article.matchCount} ocorrência(s) nas buscas</p>
                          {article.scoreReasons?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {article.scoreReasons.map(reason => <span key={reason} className="badge badge-amber">{reason}</span>)}
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
            </TicketSection>

            {/* Linked Wiki Articles */}
            <TicketSection icon="🔗" title="Artigos relacionados na Wiki" tone="neutral"
              right={<span className="badge badge-gray">{wikiLinks.length}</span>}>
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
            </TicketSection>

            {/* Linked Systems/Assets */}
            <TicketSection icon="🖥️" title="Sistemas e ativos relacionados" tone="neutral"
              right={<span className="badge badge-gray">{assetLinks.length}</span>}>
              {assetLinks.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] italic mb-3">Nenhum sistema ou ativo vinculado a este chamado ainda.</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {assetLinks.map(link => (
                    <div key={link.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-muted)] p-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {link.assetType === 'SYSTEM' ? '🖥️' : '📦'} {link.assetName}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">{link.assetSubtitle || (link.assetType === 'SYSTEM' ? 'Sistema' : 'Inventário')} · criado por {link.createdByName || 'Sistema'}</p>
                      </div>
                      <button onClick={() => handleUnlinkAsset(link.id)} className="btn btn-default btn-sm">Remover</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select value={assetPickerType} onChange={e => { setAssetPickerType(e.target.value); setAssetPickerId('') }} className="input text-xs" style={{ width: 140 }}>
                  <option value="SYSTEM">Sistema</option>
                  <option value="INVENTORY">Inventário</option>
                </select>
                <select value={assetPickerId} onChange={e => setAssetPickerId(e.target.value)} className="input text-xs" style={{ flex: '1 1 220px' }}>
                  <option value="">Selecione...</option>
                  {(assetPickerType === 'SYSTEM' ? systemsList : inventoryList).map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <button onClick={handleLinkAsset} disabled={!assetPickerId || assetLinking} className="btn btn-primary text-xs" style={{ flexShrink: 0 }}>
                  {assetLinking ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            </TicketSection>

            {/* Followups */}
            <TicketSection icon="🕓" title={`Histórico (${detail.followups.length})`} tone="neutral">
              {detail.followups.length === 0 ? (
                <p className="text-[var(--text-tertiary)] text-sm italic">Nenhum acompanhamento ainda.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {detail.followups.map(f => (
                    <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10.5, fontWeight: 700, background: 'var(--bg-muted)', color: 'var(--text-secondary)',
                      }}>{initials(f.author)}</span>
                      <div className="bg-[var(--bg-subtle)] border border-[var(--border-muted)] rounded-lg p-3" style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                          <span className="font-medium text-[var(--text-secondary)]">{f.author || 'Sistema'}</span>
                          <span>{formatDate(f.date)}</span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{f.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TicketSection>

            {actionMsg && (
              <div className={`alert ${actionMsg.type === 'success' ? 'alert-green' : 'alert-red'}`}>{actionMsg.text}</div>
            )}

            {/* Add Followup */}
            <TicketSection icon="💬" title="Adicionar resposta" tone="neutral">
              <textarea value={followupText} onChange={e => setFollowupText(e.target.value)}
                placeholder="Digite sua resposta..." rows={3}
                className="input resize-none" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={handleAddFollowup} disabled={!followupText.trim() || actionLoading}
                  className="btn btn-primary text-xs">
                  Enviar resposta
                </button>
              </div>
            </TicketSection>

            {isAdmin && (
              <TicketSection icon="🛡️" title="Ações de Admin" tone="neutral">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Encerrar este chamado</span>
                    <button onClick={handleClose} disabled={actionLoading || detail.ticket.status === 6}
                      className="btn btn-default text-xs">
                      Fechar chamado
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                      className="input text-xs" style={{ flex: '1 1 220px' }}>
                      <option value="">Selecione um técnico...</option>
                      {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button onClick={handleAssign} disabled={!assignUserId || actionLoading}
                      className="btn btn-primary text-xs" style={{ flexShrink: 0 }}>
                      Atribuir técnico
                    </button>
                  </div>
                </div>
              </TicketSection>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  )
}

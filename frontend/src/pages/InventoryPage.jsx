import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import { useAuth } from '../contexts/AuthContext'
import { getInventory, createItem, updateItem, deleteItem } from '../services/inventory'
import { downloadInventoryCsv } from '../services/reports'
import { getUsers } from '../services/users'

const TYPES   = ['COMPUTADOR', 'SERVIDOR', 'SWITCH', 'ROTEADOR', 'IMPRESSORA', 'NOBREAK', 'MONITOR', 'DVR', 'COLETOR', 'UNIFI', 'OUTRO']
const STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE']
const EMPTY_FORM = {
  name: '', type: 'COMPUTADOR', brand: '', model: '', serialNumber: '',
  location: '', responsibleId: '', purchaseDate: '', status: 'ACTIVE', notes: '',
  warrantyUntil: '', value: '',
}
const PAGE_SIZE = 20
const EMPTY_COLUMN_FILTERS = {
  tombamento: '', name: '', brand: '', model: '', serialNumber: '', location: '', responsibleName: '',
}
const COLUMN_FILTER_LABEL = {
  tombamento: 'Tombamento', name: 'Nome', brand: 'Marca', model: 'Modelo',
  serialNumber: 'Nº Série', location: 'Localização', responsibleName: 'Responsável',
}

export default function InventoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN'

  const [items, setItems]       = useState([])
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS)

  const [page, setPage]                 = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages]     = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, size: PAGE_SIZE }
      if (filterType)   params.type   = filterType
      if (filterStatus) params.status = filterStatus
      if (search)       params.search = search
      Object.entries(columnFilters).forEach(([key, value]) => {
        if (value) params[key] = value
      })
      const data = await getInventory(params)
      setItems(data.content)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus, search, columnFilters, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (isAdmin) getUsers().then(setUsers).catch(() => {}) }, [isAdmin])

  const handleSearchChange = (e) => { setPage(0); setSearch(e.target.value) }
  const handleFilterTypeChange = (e) => { setPage(0); setFilterType(e.target.value) }
  const handleFilterStatusChange = (e) => { setPage(0); setFilterStatus(e.target.value) }

  const toggleColumnFilter = (key, value) => {
    if (!value) return
    setPage(0)
    setColumnFilters(prev => ({ ...prev, [key]: prev[key] === value ? '' : value }))
  }

  const toggleBrandModelFilter = (item) => {
    if (!item.brand && !item.model) return
    setPage(0)
    setColumnFilters(prev => {
      const isActive = prev.brand === (item.brand || '') && prev.model === (item.model || '')
      return isActive ? { ...prev, brand: '', model: '' } : { ...prev, brand: item.brand || '', model: item.model || '' }
    })
  }

  const clearFilters = () => {
    setPage(0)
    setSearch('')
    setFilterType('')
    setFilterStatus('')
    setColumnFilters(EMPTY_COLUMN_FILTERS)
  }

  const activeColumnFilters = Object.entries(columnFilters).filter(([, v]) => v)
  const hasActiveFilters = !!(search || filterType || filterStatus || activeColumnFilters.length)

  const toggleTypeFilter = (type) => { setPage(0); setFilterType(prev => prev === type ? '' : type) }
  const toggleStatusFilter = (status) => { setPage(0); setFilterStatus(prev => prev === status ? '' : status) }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      name: item.name, type: item.type, brand: item.brand ?? '',
      model: item.model ?? '', serialNumber: item.serialNumber ?? '',
      location: item.location ?? '', responsibleId: item.responsible?.id ?? '',
      purchaseDate: item.purchaseDate ?? '', status: item.status, notes: item.notes ?? '',
      warrantyUntil: item.warrantyUntil ?? '', value: item.value ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        ...form,
        responsibleId: form.responsibleId || null,
        purchaseDate: form.purchaseDate || null,
        warrantyUntil: form.warrantyUntil || null,
        value: form.value !== '' ? parseFloat(form.value) : null,
      }
      if (editing) await updateItem(editing.id, payload)
      else await createItem(payload)
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteItem(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const statusLabel = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', MAINTENANCE: 'Manutenção' }
  const typeLabel   = { COMPUTADOR: 'Computador', SERVIDOR: 'Servidor', SWITCH: 'Switch',
                        ROTEADOR: 'Roteador', IMPRESSORA: 'Impressora', NOBREAK: 'Nobreak',
                        MONITOR: 'Monitor', DVR: 'DVR', COLETOR: 'Coletor', UNIFI: 'UniFi', OUTRO: 'Outro' }

  return (
    <Layout>
      <div className="page fade-up">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1>Inventário de Hardware</h1>
            <p>{totalElements} item(s) encontrado(s)</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdmin && (
              <button onClick={downloadInventoryCsv} className="btn btn-default">↓ Exportar CSV</button>
            )}
            {isAdmin && (
              <button onClick={openCreate} className="btn btn-primary">+ Novo Item</button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="filter-bar">
          <input value={search} onChange={handleSearchChange} placeholder="Buscar por nome ou nº série..." className="input" style={{ width: 220, height: 32 }} />
          <select value={filterType} onChange={handleFilterTypeChange} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os tipos</option>
            {TYPES.map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}
          </select>
          <select value={filterStatus} onChange={handleFilterStatusChange} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os status</option>
            {STATUSES.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
          </select>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="btn btn-default btn-sm">✕ Limpar filtros</button>
          )}
        </div>

        {activeColumnFilters.length > 0 && (
          <div className="filter-chips">
            {activeColumnFilters.map(([key, value]) => (
              <span key={key} className="filter-chip">
                {COLUMN_FILTER_LABEL[key]}: <strong>{value}</strong>
                <button type="button" onClick={() => { setPage(0); setColumnFilters(prev => ({ ...prev, [key]: '' })) }} aria-label="Remover filtro">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Tabela */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 6 }} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M3 6l9-3 9 3v12l-9 3-9-3V6z"/></svg></div>
              <h3>Nenhum item encontrado</h3>
              {isAdmin && <p>Clique em "Novo Item" para cadastrar.</p>}
            </div>
          ) : (
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Tombamento', 'Nome', 'Tipo', 'Marca / Modelo', 'Nº Série', 'Localização', 'Responsável', 'Status', ''].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td
                        className={`mono clickable-cell ${columnFilters.tombamento === item.tombamento ? 'active-filter' : ''}`}
                        style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}
                        onClick={() => toggleColumnFilter('tombamento', item.tombamento)}
                        title="Clique para filtrar por este tombamento"
                      >
                        {item.tombamento || '—'}
                      </td>
                      <td
                        className={`clickable-cell ${columnFilters.name === item.name ? 'active-filter' : ''}`}
                        style={{ fontWeight: 500 }}
                        onClick={() => toggleColumnFilter('name', item.name)}
                        title="Clique para filtrar por este nome"
                      >
                        {item.name}
                      </td>
                      <td className="clickable-cell" onClick={() => toggleTypeFilter(item.type)} title="Clique para filtrar por este tipo">
                        <Badge value={item.type} />
                      </td>
                      <td
                        className={`muted clickable-cell ${columnFilters.brand === (item.brand || '') && columnFilters.model === (item.model || '') && (item.brand || item.model) ? 'active-filter' : ''}`}
                        onClick={() => toggleBrandModelFilter(item)}
                        title="Clique para filtrar por marca / modelo"
                      >
                        {[item.brand, item.model].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td
                        className={`mono clickable-cell ${columnFilters.serialNumber === item.serialNumber ? 'active-filter' : ''}`}
                        onClick={() => toggleColumnFilter('serialNumber', item.serialNumber)}
                        title="Clique para filtrar por este nº de série"
                      >
                        {item.serialNumber || '—'}
                      </td>
                      <td
                        className={`muted clickable-cell ${columnFilters.location === item.location ? 'active-filter' : ''}`}
                        onClick={() => toggleColumnFilter('location', item.location)}
                        title="Clique para filtrar por esta localização"
                      >
                        {item.location || '—'}
                      </td>
                      <td
                        className={`muted clickable-cell ${columnFilters.responsibleName === item.responsible?.name ? 'active-filter' : ''}`}
                        onClick={() => toggleColumnFilter('responsibleName', item.responsible?.name)}
                        title="Clique para filtrar por este responsável"
                      >
                        {item.responsible?.name || '—'}
                      </td>
                      <td className="clickable-cell" onClick={() => toggleStatusFilter(item.status)} title="Clique para filtrar por este status">
                        <Badge value={item.status} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => navigate(`/inventory/${item.id}`)} className="btn btn-default btn-sm">Detalhes</button>
                          {isAdmin && (
                            <>
                              <button onClick={() => openEdit(item)} className="btn btn-default btn-sm">Editar</button>
                              <button onClick={() => setDeleteTarget(item)} className="btn btn-danger btn-sm">Excluir</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} totalElements={totalElements} onPageChange={setPage} />
      </div>

      {/* Modal form */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Item' : 'Novo Item'} size="lg">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-grid-2">
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Nome *</label>
              <input required value={form.name} onChange={f('name')} className="input"
                placeholder="Ex: Dell PowerEdge R740" />
            </div>
            <div>
              <label className="input-label">Tipo *</label>
              <select value={form.type} onChange={f('type')} className="input">
                {TYPES.map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Status</label>
              <select value={form.status} onChange={f('status')} className="input">
                {STATUSES.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Marca</label>
              <input value={form.brand} onChange={f('brand')} className="input"
                placeholder="Ex: Dell, HP, Cisco" />
            </div>
            <div>
              <label className="input-label">Modelo</label>
              <input value={form.model} onChange={f('model')} className="input"
                placeholder="Ex: PowerEdge R740" />
            </div>
            <div>
              <label className="input-label">Número de Série</label>
              <input value={form.serialNumber} onChange={f('serialNumber')} className="input"
                placeholder="SN..." />
            </div>
            <div>
              <label className="input-label">Localização</label>
              <input value={form.location} onChange={f('location')} className="input"
                placeholder="Ex: Rack A, Sala TI" />
            </div>
            <div>
              <label className="input-label">Responsável</label>
              <select value={form.responsibleId} onChange={f('responsibleId')} className="input">
                <option value="">— Nenhum —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Data de Compra</label>
              <input type="date" value={form.purchaseDate} onChange={f('purchaseDate')} className="input" />
            </div>
            <div>
              <label className="input-label">Garantia até</label>
              <input type="date" value={form.warrantyUntil} onChange={f('warrantyUntil')} className="input" />
            </div>
            <div>
              <label className="input-label">Valor (R$)</label>
              <input type="number" step="0.01" min="0" value={form.value} onChange={f('value')} className="input"
                placeholder="0,00" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Observações</label>
              <textarea value={form.notes} onChange={f('notes')} rows={3} className="input"
                placeholder="Observações adicionais..." />
            </div>
          </div>

          {formError && (
            <div className="alert alert-red"><p>{formError}</p></div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-default">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Salvando...' : (editing ? 'Salvar' : 'Criar')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Excluir Item"
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      />
    </Layout>
  )
}

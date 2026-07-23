import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
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
      const params = {}
      if (filterType)   params.type   = filterType
      if (filterStatus) params.status = filterStatus
      if (search)       params.search = search
      setItems(await getInventory(params))
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (isAdmin) getUsers().then(setUsers).catch(() => {}) }, [isAdmin])

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
            <p>{items.length} item(s) encontrado(s)</p>
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou nº série..." className="input" style={{ width: 220, height: 32 }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os tipos</option>
            {TYPES.map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os status</option>
            {STATUSES.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
          </select>
        </div>

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
                      <td className="mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                        {item.tombamento || '—'}
                      </td>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td><Badge value={item.type} /></td>
                      <td className="muted">{[item.brand, item.model].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="mono">{item.serialNumber || '—'}</td>
                      <td className="muted">{item.location || '—'}</td>
                      <td className="muted">{item.responsible?.name || '—'}</td>
                      <td><Badge value={item.status} /></td>
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

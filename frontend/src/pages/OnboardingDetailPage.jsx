import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { getChecklist, toggleItem, updateChecklist, addItem, updateItem, removeItem } from '../services/onboarding'
import { getUsers } from '../services/users'

const STATUS_LABEL = { IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' }

const EMPTY_ITEM_FORM = { title: '', description: '', dueDate: '', assignedToId: '' }

export default function OnboardingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [toggling, setToggling]   = useState({})
  const [users, setUsers]         = useState([])

  const [editOpen, setEditOpen]   = useState(false)
  const [editForm, setEditForm]   = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [itemForm, setItemForm]           = useState(EMPTY_ITEM_FORM)
  const [editingItemId, setEditingItemId] = useState(null)
  const [itemSaving, setItemSaving]       = useState(false)
  const [removeTarget, setRemoveTarget]   = useState(null)
  const [removing, setRemoving]           = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    return getChecklist(id).then(setChecklist).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { getUsers().then(setUsers).catch(() => {}) }, [])

  const handleToggle = async (itemId) => {
    setToggling(t => ({ ...t, [itemId]: true }))
    try {
      const updated = await toggleItem(id, itemId)
      setChecklist(updated)
    } finally { setToggling(t => { const n = {...t}; delete n[itemId]; return n }) }
  }

  const openEdit = () => {
    setEditForm({
      employeeName: checklist.employeeName,
      department: checklist.department ?? '',
      startDate: checklist.startDate ?? '',
      notes: checklist.notes ?? '',
      status: checklist.status,
    })
    setEditOpen(true)
  }

  const handleEditSave = async (e) => {
    e.preventDefault(); setEditSaving(true)
    try {
      const updated = await updateChecklist(id, { ...editForm, startDate: editForm.startDate || null })
      setChecklist(updated); setEditOpen(false)
    } finally { setEditSaving(false) }
  }

  const openAddItem = () => { setEditingItemId(null); setItemForm(EMPTY_ITEM_FORM); setItemModalOpen(true) }
  const openEditItem = (item) => {
    setEditingItemId(item.id)
    setItemForm({ title: item.title, description: item.description ?? '', dueDate: item.dueDate ?? '', assignedToId: item.assignedToId ?? '' })
    setItemModalOpen(true)
  }

  const handleItemSave = async (e) => {
    e.preventDefault(); setItemSaving(true)
    try {
      const payload = {
        title: itemForm.title,
        description: itemForm.description,
        dueDate: itemForm.dueDate || null,
        assignedToId: itemForm.assignedToId || null,
      }
      const updated = editingItemId ? await updateItem(id, editingItemId, payload) : await addItem(id, payload)
      setChecklist(updated); setItemModalOpen(false)
    } finally { setItemSaving(false) }
  }

  const handleRemoveItem = async () => {
    setRemoving(true)
    try { const updated = await removeItem(id, removeTarget.id); setChecklist(updated); setRemoveTarget(null) } finally { setRemoving(false) }
  }

  if (loading) return (
    <Layout><div className="page fade-up">{[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 8 }} />)}</div></Layout>
  )

  if (!checklist) return (
    <Layout><div className="page"><button onClick={() => navigate(-1)} className="btn btn-default btn-sm" style={{ marginBottom: 16 }}>← Voltar</button><div className="card empty-state"><h3>Checklist não encontrado</h3></div></div></Layout>
  )

  const pct = checklist.totalItems === 0 ? 0 : Math.round((checklist.doneItems / checklist.totalItems) * 100)
  const isOn = checklist.type === 'ONBOARDING'
  const today = new Date().toISOString().slice(0, 10)

  return (
    <Layout>
      <div className="page fade-up" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} className="btn btn-default btn-sm">← Voltar</button>
          <button onClick={openEdit} className="btn btn-default btn-sm">Editar</button>
        </div>

        <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: isOn ? 'var(--accent-light)' : 'var(--purple-bg)', color: isOn ? 'var(--accent-text)' : 'var(--purple)' }}>
                  {isOn ? '👋 ONBOARDING' : '🚪 OFFBOARDING'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                  {STATUS_LABEL[checklist.status] ?? checklist.status}
                </span>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{checklist.employeeName}</h1>
              {checklist.department && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{checklist.department}</p>}
              {checklist.startDate && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{new Date(checklist.startDate + 'T00:00').toLocaleDateString('pt-BR')}</p>}
              {checklist.employeeUserName && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Usuário: {checklist.employeeUserName}</p>}
              {checklist.inventoryItemName && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Equipamento: {checklist.inventoryItemName}</p>}
              {checklist.notes && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{checklist.notes}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: pct === 100 ? 'var(--success)' : 'var(--accent)' }}>{pct}%</p>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{checklist.doneItems} de {checklist.totalItems}</p>
            </div>
          </div>
          <div style={{ marginTop: 14, height: 8, background: 'var(--border-muted)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p className="label-caps">Tarefas</p>
          <button onClick={openAddItem} className="btn btn-default btn-sm">+ Tarefa</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {checklist.items.map(item => {
            const overdue = item.dueDate && !item.done && item.dueDate < today
            return (
              <div key={item.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: toggling[item.id] ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <div
                  onClick={() => !toggling[item.id] && handleToggle(item.id)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    border: item.done ? 'none' : '2px solid var(--border-muted)',
                    background: item.done ? 'var(--success)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {item.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => !toggling[item.id] && handleToggle(item.id)}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: item.done ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none' }}>
                    {item.title}
                  </p>
                  {item.description && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.description}</p>}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 3 }}>
                    {item.dueDate && (
                      <span style={{ fontSize: 11, color: overdue ? 'var(--red)' : 'var(--text-tertiary)', fontWeight: overdue ? 700 : 400 }}>
                        {overdue ? '⚠ ' : ''}Prazo: {new Date(item.dueDate + 'T00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {item.assignedToName && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Responsável: {item.assignedToName}</span>}
                    {item.doneBy && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Concluído por {item.doneBy} em {new Date(item.doneAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEditItem(item)} className="btn btn-default btn-sm">Editar</button>
                  <button onClick={() => setRemoveTarget(item)} className="btn btn-danger btn-sm">Excluir</button>
                </div>
              </div>
            )
          })}
          {checklist.items.length === 0 && <div className="card empty-state"><h3>Nenhuma tarefa</h3></div>}
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar Checklist">
        {editForm && (
          <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="input-label">Nome do Funcionário *</label>
              <input required value={editForm.employeeName} onChange={e => setEditForm(p => ({ ...p, employeeName: e.target.value }))} className="input" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label className="input-label">Setor</label>
                <input value={editForm.department} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="input-label">Data de Início</label>
                <input type="date" value={editForm.startDate} onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))} className="input" />
              </div>
            </div>
            <div>
              <label className="input-label">Status</label>
              <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} className="input">
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="COMPLETED">Concluído</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="input-label">Observações</label>
              <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setEditOpen(false)} className="btn btn-default">Cancelar</button>
              <button type="submit" disabled={editSaving} className="btn btn-primary">{editSaving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={itemModalOpen} onClose={() => setItemModalOpen(false)} title={editingItemId ? 'Editar Tarefa' : 'Nova Tarefa'}>
        <form onSubmit={handleItemSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">Título *</label>
            <input required value={itemForm.title} onChange={e => setItemForm(p => ({ ...p, title: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="input-label">Descrição</label>
            <textarea value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} rows={2} className="input" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div>
              <label className="input-label">Prazo</label>
              <input type="date" value={itemForm.dueDate} onChange={e => setItemForm(p => ({ ...p, dueDate: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="input-label">Responsável</label>
              <select value={itemForm.assignedToId} onChange={e => setItemForm(p => ({ ...p, assignedToId: e.target.value }))} className="input">
                <option value="">Ninguém</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setItemModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={itemSaving} className="btn btn-primary">{itemSaving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} onConfirm={handleRemoveItem} loading={removing}
        title="Excluir Tarefa" message={`Excluir a tarefa "${removeTarget?.title}"?`} />
    </Layout>
  )
}

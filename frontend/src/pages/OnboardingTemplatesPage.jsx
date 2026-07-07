import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../services/onboardingTemplates'

const EMPTY_FORM = { type: 'ONBOARDING', name: '', active: true, items: [] }

export default function OnboardingTemplatesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTemplates(await getTemplates(filter ? { type: filter } : {})) } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (!isAdmin) {
    return (
      <Layout>
        <div className="page fade-up">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Templates de Onboarding</h1>
              <p>Acesso restrito a administradores</p>
            </div>
          </div>
          <div className="card empty-state">
            <h3>Você não tem permissão para acessar esta área</h3>
            <p>Fale com um administrador se precisar ajustar um template.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit = (t) => {
    setEditingId(t.id)
    setForm({ type: t.type, name: t.name, active: t.active, items: t.items.map(i => ({ title: i.title, description: i.description ?? '' })) })
    setModalOpen(true)
  }

  const setItem = (idx, key, value) => setForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [key]: value } : it) }))
  const addItemRow = () => setForm(p => ({ ...p, items: [...p.items, { title: '', description: '' }] }))
  const removeItemRow = (idx) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))
  const moveItemRow = (idx, dir) => setForm(p => {
    const items = [...p.items]
    const target = idx + dir
    if (target < 0 || target >= items.length) return p
    ;[items[idx], items[target]] = [items[target], items[idx]]
    return { ...p, items }
  })

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        type: form.type,
        name: form.name,
        active: form.active,
        items: form.items.filter(i => i.title.trim()).map((i, idx) => ({ title: i.title, description: i.description, itemOrder: idx })),
      }
      if (editingId) await updateTemplate(editingId, payload)
      else await createTemplate(payload)
      setModalOpen(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteTemplate(deleteTarget.id); setDeleteTarget(null); load() } finally { setDeleting(false) }
  }

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Templates de Onboarding</h1>
            <p>Modelos de checklist reutilizados ao criar um onboarding/offboarding</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/onboarding')} className="btn btn-default">← Voltar</button>
            <button onClick={openCreate} className="btn btn-primary">+ Novo Template</button>
          </div>
        </div>

        <div className="filter-bar">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os tipos</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="OFFBOARDING">Offboarding</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="card empty-state"><h3>Nenhum template encontrado</h3></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {templates.map(t => (
              <div key={t.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: t.type === 'ONBOARDING' ? 'var(--accent-light)' : 'var(--purple-bg)', color: t.type === 'ONBOARDING' ? 'var(--accent-text)' : 'var(--purple)' }}>
                      {t.type === 'ONBOARDING' ? 'ONBOARDING' : 'OFFBOARDING'}
                    </span>
                    {!t.active && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}>Inativo</span>}
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text-primary)' }}>{t.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{t.items.length} tarefas</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => openEdit(t)} className="btn btn-default btn-sm">Editar</button>
                  <button onClick={() => setDeleteTarget(t)} className="btn btn-danger btn-sm">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar Template' : 'Novo Template'} size="lg">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div>
              <label className="input-label">Tipo *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="input">
                <option value="ONBOARDING">Onboarding (entrada)</option>
                <option value="OFFBOARDING">Offboarding (saída)</option>
              </select>
            </div>
            <div>
              <label className="input-label">Nome *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="Padrão" />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
            Ativo (aparece na criação de novos checklists)
          </label>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="input-label" style={{ margin: 0 }}>Tarefas</label>
              <button type="button" onClick={addItemRow} className="btn btn-default btn-sm">+ Tarefa</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {form.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button type="button" onClick={() => moveItemRow(idx, -1)} className="btn btn-default btn-sm" disabled={idx === 0}>↑</button>
                    <button type="button" onClick={() => moveItemRow(idx, 1)} className="btn btn-default btn-sm" disabled={idx === form.items.length - 1}>↓</button>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input required value={item.title} onChange={e => setItem(idx, 'title', e.target.value)} className="input" placeholder="Título da tarefa" />
                    <input value={item.description} onChange={e => setItem(idx, 'description', e.target.value)} className="input" placeholder="Descrição (opcional)" />
                  </div>
                  <button type="button" onClick={() => removeItemRow(idx)} className="btn btn-danger btn-sm">×</button>
                </div>
              ))}
              {form.items.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Nenhuma tarefa — clique em "+ Tarefa" para adicionar.</p>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Excluir Template" message={`Excluir o template "${deleteTarget?.name}"?`} />
    </Layout>
  )
}

import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getSystems, createSystem, updateSystem, deleteSystem } from '../services/systems'
import { getInventory } from '../services/inventory'
import { getUsers } from '../services/users'

const CATEGORIES = ['ERP', 'CRM', 'INTERNO', 'CLOUD', 'MONITORAMENTO', 'OUTRO']
const EMPTY_FORM = {
  name: '', url: '', description: '', category: 'OUTRO',
  serverId: '', responsibleId: '', status: 'ACTIVE', documentation: '',
}

export default function SystemsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [systems, setSystems]     = useState([])
  const [users, setUsers]         = useState([])
  const [servers, setServers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [filterSt, setFilterSt]   = useState('')

  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterCat) params.category = filterCat
      if (filterSt)  params.status   = filterSt
      setSystems(await getSystems(params))
    } finally {
      setLoading(false)
    }
  }, [filterCat, filterSt])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (isAdmin) {
      getUsers().then(setUsers).catch(() => {})
      getInventory({ type: 'SERVIDOR' }).then(setServers).catch(() => {})
    }
  }, [isAdmin])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({
      name: s.name, url: s.url ?? '', description: s.description ?? '',
      category: s.category, serverId: s.server?.id ?? '',
      responsibleId: s.responsible?.id ?? '', status: s.status,
      documentation: s.documentation ?? '',
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
        serverId: form.serverId || null,
        responsibleId: form.responsibleId || null,
      }
      if (editing) await updateSystem(editing.id, payload)
      else await createSystem(payload)
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
      await deleteSystem(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Layout>
      <div className="page fade-up">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1>Catálogo de Sistemas</h1>
            <p>{systems.length} sistema(s) encontrado(s)</p>
          </div>
          {isAdmin && (
            <button onClick={openCreate} className="btn btn-primary">+ Novo Sistema</button>
          )}
        </div>

        {/* Filtros */}
        <div className="filter-bar">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todas as categorias</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterSt} onChange={e => setFilterSt(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>

        {/* Grid de cards */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--r-lg)' }} />)}
          </div>
        ) : systems.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon"><svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
            <h3>Nenhum sistema encontrado</h3>
            {isAdmin && <p>Clique em "Novo Sistema" para cadastrar.</p>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14 }}>
            {systems.map(s => (
              <div key={s.id} className="card card-hover" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.name}</p>
                  <Badge value={s.status} />
                </div>
                <Badge value={s.category} />
                {s.description && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.description}</p>
                )}
                {s.responsible && (
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Responsável: {s.responsible.name}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-muted)' }}>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                      Acessar ↗
                    </a>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => openEdit(s)} className="btn btn-default btn-sm">Editar</button>
                      <button onClick={() => setDeleteTarget(s)} className="btn btn-danger btn-sm">✕</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Sistema' : 'Novo Sistema'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input required value={form.name} onChange={f('name')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome do sistema" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
              <input value={form.url} onChange={f('url')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria *</label>
              <select value={form.category} onChange={f('category')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={form.status} onChange={f('status')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Responsável</label>
              <select value={form.responsibleId} onChange={f('responsibleId')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Nenhum —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Servidor (inventário)</label>
              <select value={form.serverId} onChange={f('serverId')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Nenhum —</option>
                {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <textarea value={form.description} onChange={f('description')} rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Breve descrição do sistema" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Documentação</label>
              <textarea value={form.documentation} onChange={f('documentation')} rows={4}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                placeholder="Documentação em texto livre..." />
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg font-medium">
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
        title="Excluir Sistema"
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      />
    </Layout>
  )
}

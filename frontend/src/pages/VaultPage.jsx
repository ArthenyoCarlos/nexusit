import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { getCredentials, revealSecret, createCredential, updateCredential, deleteCredential } from '../services/vault'

const TYPES = ['PASSWORD', 'SSH', 'API_KEY', 'CERTIFICATE', 'TOKEN', 'OTHER']
const TYPE_ICON = { PASSWORD: '🔑', SSH: '🖥️', API_KEY: '🔗', CERTIFICATE: '📜', TOKEN: '🎫', OTHER: '🔒' }
const EMPTY = { title: '', type: 'PASSWORD', username: '', secret: '', url: '', description: '', tags: '' }

export default function VaultPage() {
  const [creds, setCreds]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('')
  const [revealed, setRevealed]     = useState({})
  const [revealing, setRevealing]   = useState({})

  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCreds(await getCredentials({ search: search || undefined, type: filterType || undefined }))
    } finally { setLoading(false) }
  }, [search, filterType])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError(''); setShowSecret(false); setModalOpen(true) }
  const openEdit   = (c) => { setEditing(c); setForm({ title: c.title, type: c.type, username: c.username ?? '', secret: '••••••••', url: c.url ?? '', description: c.description ?? '', tags: c.tags ?? '' }); setFormError(''); setShowSecret(false); setModalOpen(true) }

  const handleReveal = async (id) => {
    if (revealed[id]) { setRevealed(r => { const n = {...r}; delete n[id]; return n }); return }
    setRevealing(r => ({ ...r, [id]: true }))
    try {
      const secret = await revealSecret(id)
      setRevealed(r => ({ ...r, [id]: secret }))
    } finally { setRevealing(r => { const n = {...r}; delete n[id]; return n }) }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setFormError('')
    try {
      const payload = { ...form, secret: editing && form.secret === '••••••••' ? undefined : form.secret }
      if (editing) await updateCredential(editing.id, payload)
      else await createCredential(payload)
      setModalOpen(false); load()
    } catch (err) { setFormError(err.response?.data?.detail ?? 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteCredential(deleteTarget.id); setDeleteTarget(null); load() }
    finally { setDeleting(false) }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Cofre de Credenciais</h1>
            <p>Acesso restrito a administradores — dados criptografados com AES-256-GCM</p>
          </div>
          <button onClick={openCreate} className="btn btn-primary">+ Nova Credencial</button>
        </div>

        <div className="filter-bar">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="input" style={{ width: 220, height: 32 }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os tipos</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />)}
          </div>
        ) : creds.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">🔒</div>
            <h3>Nenhuma credencial cadastrada</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {creds.map(c => (
              <div key={c.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{TYPE_ICON[c.type] || '🔒'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{c.title}</p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                    {c.username && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>👤 {c.username}</span>}
                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }} className="truncate">🔗 {c.url}</a>}
                    {c.tags && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>🏷️ {c.tags}</span>}
                  </div>
                  {revealed[c.id] && (
                    <div style={{ marginTop: 8, background: 'var(--bg-muted)', padding: '6px 10px', borderRadius: 6, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                      {revealed[c.id]}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleReveal(c.id)} disabled={revealing[c.id]} className="btn btn-default btn-sm">
                    {revealing[c.id] ? '...' : revealed[c.id] ? 'Ocultar' : 'Revelar'}
                  </button>
                  <button onClick={() => openEdit(c)} className="btn btn-default btn-sm">Editar</button>
                  <button onClick={() => setDeleteTarget(c)} className="btn btn-danger btn-sm">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Credencial' : 'Nova Credencial'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
              <input required value={form.title} onChange={f('title')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: VPN Corporativa" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={form.type} onChange={f('type')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usuário / Login</label>
              <input value={form.username} onChange={f('username')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha / Chave / Token *</label>
              <div style={{ position: 'relative' }}>
                <input required={!editing} value={form.secret} onChange={f('secret')}
                  type={showSecret ? 'text' : 'password'}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20"
                  placeholder={editing ? 'Deixe em branco para manter a atual' : 'Senha ou chave...'} />
                <button type="button" onClick={() => setShowSecret(s => !s)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showSecret ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
              <input value={form.url} onChange={f('url')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
              <input value={form.tags} onChange={f('tags')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="vpn, produção, rede" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input value={form.description} onChange={f('description')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg font-medium">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Excluir Credencial" message={`Excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`} />
    </Layout>
  )
}

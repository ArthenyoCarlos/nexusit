import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getCredentials, revealSecret, createCredential, updateCredential, deleteCredential, getVaultwardenCredentials, revealVaultwardenSecret } from '../services/vault'

const TYPES = ['PASSWORD', 'SSH', 'API_KEY', 'CERTIFICATE', 'TOKEN', 'OTHER']
const TYPE_ICON = { PASSWORD: '🔑', SSH: '🖥️', API_KEY: '🔗', CERTIFICATE: '📜', TOKEN: '🎫', OTHER: '🔒' }
const EMPTY = { title: '', type: 'PASSWORD', username: '', secret: '', url: '', description: '', tags: '' }

export default function VaultPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
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

  const [vwCreds, setVwCreds]         = useState([])
  const [vwLoading, setVwLoading]     = useState(true)
  const [vwRevealed, setVwRevealed]   = useState({})
  const [vwRevealing, setVwRevealing] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCreds(await getCredentials({ search: search || undefined, type: filterType || undefined }))
    } finally { setLoading(false) }
  }, [search, filterType])

  const loadVaultwarden = useCallback(async () => {
    setVwLoading(true)
    try { setVwCreds(await getVaultwardenCredentials()) }
    catch { setVwCreds([]) }
    finally { setVwLoading(false) }
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])
  useEffect(() => { if (isAdmin) loadVaultwarden() }, [isAdmin, loadVaultwarden])

  const handleRevealVw = async (id) => {
    if (vwRevealed[id]) { setVwRevealed(r => { const n = {...r}; delete n[id]; return n }); return }
    setVwRevealing(r => ({ ...r, [id]: true }))
    try {
      const secret = await revealVaultwardenSecret(id)
      setVwRevealed(r => ({ ...r, [id]: secret }))
    } catch { /* falha ao decifrar, item fica sem revelar */ }
    finally { setVwRevealing(r => { const n = {...r}; delete n[id]; return n }) }
  }

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

  if (!isAdmin) {
    return (
      <Layout>
        <div className="page fade-up">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Cofre de Credenciais</h1>
              <p>Acesso restrito a administradores</p>
            </div>
          </div>
          <div className="card empty-state">
            <h3>Você não tem permissão para acessar o Cofre</h3>
            <p>Esta área é restrita a administradores. Fale com um admin do NexusIT se precisar de uma credencial.</p>
          </div>
        </div>
      </Layout>
    )
  }

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '28px 0 12px' }}>
          <p className="label-caps">Do Vaultwarden</p>
          <span className="badge badge-blue">{vwCreds.length}</span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>
          Itens criados diretamente no Vaultwarden (organização "Armazem Galdino") — somente leitura aqui.
        </p>

        {vwLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 8 }} />)}
          </div>
        ) : vwCreds.length === 0 ? (
          <div className="card empty-state">
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nenhum item encontrado no Vaultwarden (ou a integração não está configurada).</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vwCreds.map(c => (
              <div key={c.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🔑</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{c.name}</p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                    {c.username && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>👤 {c.username}</span>}
                    {c.uri && <a href={c.uri} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>🔗 {c.uri}</a>}
                  </div>
                  {vwRevealed[c.id] && (
                    <div style={{ marginTop: 8, background: 'var(--bg-muted)', padding: '6px 10px', borderRadius: 6, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                      {vwRevealed[c.id]}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleRevealVw(c.id)} disabled={vwRevealing[c.id]} className="btn btn-default btn-sm">
                    {vwRevealing[c.id] ? '...' : vwRevealed[c.id] ? 'Ocultar' : 'Revelar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Credencial' : 'Nova Credencial'} size="lg">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Título *</label>
              <input required value={form.title} onChange={f('title')} className="input" placeholder="Ex: VPN Corporativa" />
            </div>
            <div>
              <label className="input-label">Tipo</label>
              <select value={form.type} onChange={f('type')} className="input">
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Usuário / Login</label>
              <input value={form.username} onChange={f('username')} className="input" placeholder="admin" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Senha / Chave / Token *</label>
              <div style={{ position: 'relative' }}>
                <input required={!editing} value={form.secret} onChange={f('secret')}
                  type={showSecret ? 'text' : 'password'}
                  className="input"
                  style={{ paddingRight: 64 }}
                  placeholder={editing ? 'Deixe em branco para manter a atual' : 'Senha ou chave...'} />
                <button type="button" onClick={() => setShowSecret(s => !s)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showSecret ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="input-label">URL</label>
              <input value={form.url} onChange={f('url')} className="input" placeholder="https://..." />
            </div>
            <div>
              <label className="input-label">Tags</label>
              <input value={form.tags} onChange={f('tags')} className="input" placeholder="vpn, produção, rede" />
            </div>
            <div>
              <label className="input-label">Descrição</label>
              <input value={form.description} onChange={f('description')} className="input" />
            </div>
          </div>
          {formError && <div className="alert alert-red"><p>{formError}</p></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Excluir Credencial" message={`Excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`} />
    </Layout>
  )
}

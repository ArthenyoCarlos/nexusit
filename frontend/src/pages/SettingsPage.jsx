import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUsers, createUser, updateUser, deleteUser } from '../services/users'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const REFRESH_KEY = 'nexusit_refresh_interval'
const REFRESH_OPTIONS = [
  { label: '30 s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
]
const EMPTY_FORM = { name: '', email: '', password: '', role: 'TECHNICIAN', jobTitle: 'Técnico(a)' }

export default function SettingsPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(() => Number(localStorage.getItem(REFRESH_KEY) ?? 60))
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    try { const data = await getUsers(); setUsers(data) }
    catch { setUsers([]) }
    finally { setLoading(false) }
  }

  function handleRefreshChange(v) { setRefreshInterval(v); localStorage.setItem(REFRESH_KEY, String(v)) }
  function openCreate() { setEditingUser(null); setForm(EMPTY_FORM); setError(null); setModalOpen(true) }
  function openEdit(u) { setEditingUser(u); setForm({ name: u.name, email: u.email, password: '', role: u.role, jobTitle: u.jobTitle || (u.role === 'ADMIN' ? 'Administrador(a)' : 'Técnico(a)') }); setError(null); setModalOpen(true) }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      if (editingUser) {
        await updateUser(editingUser.id, { name: form.name, role: form.role, jobTitle: form.jobTitle, active: editingUser.active, password: form.password || undefined })
      } else {
        await createUser({ name: form.name, email: form.email, password: form.password, role: form.role, jobTitle: form.jobTitle })
      }
      setModalOpen(false); loadUsers()
    } catch (err) { setError(err?.response?.data?.message ?? 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  async function handleToggleActive(u) {
    try { await updateUser(u.id, { active: !u.active }); loadUsers() } catch {}
  }

  async function handleDelete(u) {
    if (!window.confirm(`Excluir "${u.name}"?`)) return
    try { await deleteUser(u.id); loadUsers() } catch {}
  }

  if (me?.role !== 'ADMIN') {
    return (
      <Layout>
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <h3>Acesso restrito</h3>
            <p>Esta página é exclusiva para administradores.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page fade-up" style={{ maxWidth: 860 }}>
        <div className="page-header">
          <div className="page-header-left">
            <h1>Configurações</h1>
            <p>Administração do sistema e preferências</p>
          </div>
        </div>

        {/* Auto-refresh */}
        <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Intervalo de atualização automática</p>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 14 }}>Frequência de polling nas páginas de monitoramento.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {REFRESH_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => handleRefreshChange(opt.value)}
                className={refreshInterval === opt.value ? 'btn btn-primary' : 'btn btn-default'}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Users */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-muted)' }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Gerenciamento de Usuários</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{users.length} usuário(s) cadastrado(s)</p>
            </div>
            <button onClick={openCreate} className="btn btn-primary btn-sm">+ Novo usuário</button>
          </div>

          {loading ? (
            <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 'var(--r-md)' }} />)}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Email</th>
                    <th>Perfil</th>
                    <th>Cargo</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500 }}>{u.name}</span>
                        </div>
                      </td>
                      <td className="muted">{u.email}</td>
                      <td>
                        <span className={u.role === 'ADMIN' ? 'badge badge-purple' : 'badge badge-gray'}>
                          {u.role === 'ADMIN' ? 'Admin' : 'Técnico'}
                        </span>
                      </td>
                      <td className="muted">{u.jobTitle || (u.role === 'ADMIN' ? 'Administrador(a)' : 'Técnico(a)')}</td>
                      <td>
                        <span className={u.active ? 'badge badge-green' : 'badge badge-red'}>
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => openEdit(u)} className="btn btn-default btn-sm">Editar</button>
                          <button onClick={() => handleToggleActive(u)} className="btn btn-default btn-sm">
                            {u.active ? 'Desativar' : 'Ativar'}
                          </button>
                          {u.id !== me?.id && (
                            <button onClick={() => handleDelete(u)} className="btn btn-danger btn-sm">Excluir</button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? 'Editar usuário' : 'Novo usuário'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="input-label">Nome completo</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" />
          </div>
          {!editingUser && (
            <div>
              <label className="input-label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" />
            </div>
          )}
          <div>
            <label className="input-label">{editingUser ? 'Nova senha (opcional)' : 'Senha'}</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="input-label">Perfil</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, jobTitle: f.jobTitle || (e.target.value === 'ADMIN' ? 'Administrador(a)' : 'Técnico(a)') }))} className="input">
              <option value="TECHNICIAN">Técnico</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div>
            <label className="input-label">Cargo usado no WhatsApp</label>
            <input type="text" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="Ex.: Técnico(a), Consultor(a), Supervisor(a)" className="input" />
            <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>A assinatura enviada ao cliente ficará em negrito, ex.: *{form.jobTitle || 'Técnico(a)'} {form.name || 'Nome'}:*</p>
          </div>
          {error && <p style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? 'Salvando...' : editingUser ? 'Salvar' : 'Criar usuário'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

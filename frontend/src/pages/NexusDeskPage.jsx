import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getNexusDeskDevices, createNexusDeskDevice, updateNexusDeskDevice, deleteNexusDeskDevice, connectNexusDeskDevice, getNexusDeskSessions } from '../services/nexusdesk'
import { getInventory } from '../services/inventory'

const EMPTY_FORM = { name: '', rustdeskId: '', password: '', notes: '', inventoryItemId: '' }

function buildRustDeskUri(rustdeskId, password) {
  const id = (rustdeskId || '').trim().replace(/\s+/g, '')
  return `rustdesk://${id}${password ? `?password=${encodeURIComponent(password)}` : ''}`
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

export default function NexusDeskPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [devices, setDevices] = useState([])
  const [sessions, setSessions] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [connectingId, setConnectingId] = useState(null)
  const [adhocId, setAdhocId] = useState('')
  const [adhocPassword, setAdhocPassword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, s] = await Promise.all([getNexusDeskDevices(), getNexusDeskSessions()])
      setDevices(d); setSessions(s)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (isAdmin) { load(); getInventory().then(setInventory).catch(() => {}) } }, [isAdmin, load])

  if (!isAdmin) {
    return (
      <Layout>
        <div className="page fade-up">
          <div className="page-header">
            <div className="page-header-left">
              <h1>NexusDesk</h1>
              <p>Acesso restrito a administradores</p>
            </div>
          </div>
          <div className="card empty-state">
            <h3>Você não tem permissão para acessar o NexusDesk</h3>
            <p>Esta área é restrita a administradores.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit = (d) => {
    setEditingId(d.id)
    setForm({ name: d.name, rustdeskId: d.rustdeskId, password: '', notes: d.notes ?? '', inventoryItemId: d.inventoryItemId ?? '' })
    setModalOpen(true)
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, inventoryItemId: form.inventoryItemId || null }
      if (editingId) await updateNexusDeskDevice(editingId, payload)
      else await createNexusDeskDevice(payload)
      setModalOpen(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteNexusDeskDevice(deleteTarget.id); setDeleteTarget(null); load() } finally { setDeleting(false) }
  }

  const handleConnect = async (device) => {
    setConnectingId(device.id)
    try {
      const { rustdeskId, password } = await connectNexusDeskDevice(device.id)
      window.location.href = buildRustDeskUri(rustdeskId, password)
      load()
    } finally { setConnectingId(null) }
  }

  const handleAdhocConnect = (e) => {
    e.preventDefault()
    if (!adhocId.trim()) return
    window.location.href = buildRustDeskUri(adhocId, adhocPassword)
  }

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>NexusDesk</h1>
            <p>Acesso remoto às máquinas dos funcionários (RustDesk self-hospedado)</p>
          </div>
          <button onClick={openCreate} className="btn btn-primary">+ Nova Máquina</button>
        </div>

        {/* Acesso avulso */}
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <p className="label-caps" style={{ marginBottom: 10 }}>Acesso avulso</p>
          <form onSubmit={handleAdhocConnect} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="input-label">ID do RustDesk</label>
              <input value={adhocId} onChange={e => setAdhocId(e.target.value)} className="input" placeholder="Código exibido na tela do funcionário" />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label className="input-label">Senha (se souber)</label>
              <input type="password" value={adhocPassword} onChange={e => setAdhocPassword(e.target.value)} className="input" />
            </div>
            <button type="submit" disabled={!adhocId.trim()} className="btn btn-default" style={{ flexShrink: 0 }}>Conectar</button>
          </form>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 84, borderRadius: 10 }} />)}
          </div>
        ) : devices.length === 0 ? (
          <div className="card empty-state"><h3>Nenhuma máquina cadastrada</h3><p>Clique em "+ Nova Máquina" para adicionar a primeira.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {devices.map(d => (
              <div key={d.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text-primary)' }}>{d.name}</p>
                    <span className={d.hasPassword ? 'badge badge-green' : 'badge badge-amber'} style={{ fontSize: 10.5 }}>
                      {d.hasPassword ? 'Acesso não-assistido' : 'Sem senha salva'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>ID {d.rustdeskId}</p>
                  {d.inventoryItemName && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Equipamento: {d.inventoryItemName}</p>}
                  {d.notes && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{d.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleConnect(d)} disabled={connectingId === d.id} className="btn btn-primary btn-sm">
                    {connectingId === d.id ? 'Conectando...' : 'Conectar'}
                  </button>
                  <button onClick={() => openEdit(d)} className="btn btn-default btn-sm">Editar</button>
                  <button onClick={() => setDeleteTarget(d)} className="btn btn-danger btn-sm">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {sessions.length > 0 && (
          <div className="card" style={{ padding: 16, marginTop: 24 }}>
            <p className="label-caps" style={{ marginBottom: 10 }}>Histórico de acessos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.slice(0, 20).map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)', padding: '4px 0', borderBottom: '1px solid var(--border-muted)' }}>
                  <span>{s.userName} acessou <strong>{s.deviceName}</strong>{s.glpiTicketId ? ` (chamado #${s.glpiTicketId})` : ''}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{timeAgo(s.startedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar Máquina' : 'Nova Máquina'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">Nome *</label>
            <input required value={form.name} onChange={f('name')} className="input" placeholder="Ex: PC do João - Financeiro" />
          </div>
          <div>
            <label className="input-label">ID do RustDesk *</label>
            <input required value={form.rustdeskId} onChange={f('rustdeskId')} className="input" placeholder="Código exibido no app instalado na máquina" />
          </div>
          <div>
            <label className="input-label">Senha de acesso não-assistido {editingId ? '(deixe em branco para manter)' : '(opcional)'}</label>
            <input type="password" value={form.password} onChange={f('password')} className="input" placeholder="Sem isso, o funcionário precisa ler a senha na tela dele" />
          </div>
          <div>
            <label className="input-label">Equipamento (Inventário)</label>
            <select value={form.inventoryItemId} onChange={f('inventoryItemId')} className="input">
              <option value="">Nenhum</option>
              {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Notas</label>
            <textarea value={form.notes} onChange={f('notes')} rows={2} className="input" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Excluir Máquina" message={`Excluir a máquina "${deleteTarget?.name}"? As credenciais salvas serão apagadas.`} />
    </Layout>
  )
}

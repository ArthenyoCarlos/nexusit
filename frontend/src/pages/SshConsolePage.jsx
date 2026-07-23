import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import SshTerminal from '../components/SshTerminal'
import { useAuth } from '../contexts/AuthContext'
import { getSshHosts, createSshHost, updateSshHost, deleteSshHost, resetHostKey } from '../services/sshHosts'
import { getAllInventory } from '../services/inventory'

const EMPTY_FORM = {
  name: '', host: '', port: 22, username: '', authType: 'PASSWORD',
  password: '', privateKey: '', privateKeyPassphrase: '', description: '', inventoryItemId: ''
}

export default function SshConsolePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [hosts, setHosts]         = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [connectTarget, setConnectTarget] = useState(null)
  const [resettingId, setResettingId]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setHosts(await getSshHosts()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (isAdmin) { load(); getAllInventory().then(setInventory).catch(() => {}) } }, [isAdmin, load])

  if (!isAdmin) {
    return (
      <Layout>
        <div className="page fade-up">
          <div className="page-header">
            <div className="page-header-left">
              <h1>Console SSH</h1>
              <p>Acesso restrito a administradores</p>
            </div>
          </div>
          <div className="card empty-state">
            <h3>Você não tem permissão para acessar o Console SSH</h3>
            <p>Esta área é restrita a administradores.</p>
          </div>
        </div>
      </Layout>
    )
  }

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true) }
  const openEdit = (h) => {
    setEditingId(h.id)
    setForm({
      name: h.name,
      host: h.host,
      port: h.port,
      username: h.username,
      authType: h.authType ?? 'PASSWORD',
      password: '',
      privateKey: '',
      privateKeyPassphrase: '',
      description: h.description ?? '',
      inventoryItemId: h.inventoryItemId ?? ''
    })
    setModalOpen(true)
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        port: Number(form.port),
        inventoryItemId: form.inventoryItemId || null,
        password: form.authType === 'PASSWORD' ? form.password : '',
        privateKey: form.authType === 'PRIVATE_KEY' ? form.privateKey : '',
        privateKeyPassphrase: form.authType === 'PRIVATE_KEY' ? form.privateKeyPassphrase : ''
      }
      if (editingId) await updateSshHost(editingId, payload)
      else await createSshHost(payload)
      setModalOpen(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteSshHost(deleteTarget.id); setDeleteTarget(null); load() } finally { setDeleting(false) }
  }

  const handleResetHostKey = async (id) => {
    setResettingId(id)
    try { await resetHostKey(id); load() } finally { setResettingId(null) }
  }

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Console SSH</h1>
            <p>Máquinas cadastradas para acesso remoto via terminal</p>
          </div>
          <button onClick={openCreate} className="btn btn-primary">+ Nova Máquina</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 84, borderRadius: 10 }} />)}
          </div>
        ) : hosts.length === 0 ? (
          <div className="card empty-state"><h3>Nenhuma máquina cadastrada</h3><p>Clique em "+ Nova Máquina" para adicionar a primeira.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hosts.map(h => (
              <div key={h.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text-primary)' }}>{h.name}</p>
                    <span className={h.hostKeyTrusted ? 'badge badge-green' : 'badge badge-amber'} style={{ fontSize: 10.5 }}>
                      {h.hostKeyTrusted ? 'Chave do host confirmada' : 'Nunca conectado'}
                    </span>
                    <span className="badge badge-blue" style={{ fontSize: 10.5 }}>
                      {h.authType === 'PRIVATE_KEY' ? 'Chave SSH' : 'Senha'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{h.username}@{h.host}:{h.port}</p>
                  {h.inventoryItemName && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Equipamento: {h.inventoryItemName}</p>}
                  {h.description && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{h.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setConnectTarget(h)} className="btn btn-primary btn-sm">Conectar</button>
                  <button onClick={() => openEdit(h)} className="btn btn-default btn-sm">Editar</button>
                  {h.hostKeyTrusted && (
                    <button onClick={() => handleResetHostKey(h.id)} disabled={resettingId === h.id} className="btn btn-default btn-sm">
                      {resettingId === h.id ? 'Resetando...' : 'Resetar chave'}
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(h)} className="btn btn-danger btn-sm">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar Máquina' : 'Nova Máquina'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">Nome *</label>
            <input required value={form.name} onChange={f('name')} className="input" placeholder="Ex: Servidor Interno NexusIT" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 14 }}>
            <div>
              <label className="input-label">Host / IP *</label>
              <input required value={form.host} onChange={f('host')} className="input" placeholder="192.168.2.210" />
            </div>
            <div>
              <label className="input-label">Porta *</label>
              <input required type="number" value={form.port} onChange={f('port')} className="input" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div>
              <label className="input-label">Usuário *</label>
              <input required value={form.username} onChange={f('username')} className="input" placeholder="galdino" />
            </div>
            <div>
              <label className="input-label">Autenticação *</label>
              <select required value={form.authType} onChange={f('authType')} className="input">
                <option value="PASSWORD">Senha</option>
                <option value="PRIVATE_KEY">Chave privada SSH</option>
              </select>
            </div>
          </div>

          {form.authType === 'PASSWORD' ? (
            <div>
              <label className="input-label">Senha {editingId ? '(deixe em branco para manter)' : '*'}</label>
              <input required={!editingId} type="password" value={form.password} onChange={f('password')} className="input" />
            </div>
          ) : (
            <>
              <div>
                <label className="input-label">Chave privada {editingId ? '(deixe em branco para manter)' : '*'}</label>
                <textarea
                  required={!editingId}
                  value={form.privateKey}
                  onChange={f('privateKey')}
                  rows={8}
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  placeholder={'Cole aqui o conteúdo do arquivo id_ed25519, começando por -----BEGIN OPENSSH PRIVATE KEY-----'}
                />
              </div>
              <div>
                <label className="input-label">Senha da chave / passphrase (se houver)</label>
                <input type="password" value={form.privateKeyPassphrase} onChange={f('privateKeyPassphrase')} className="input" />
              </div>
            </>
          )}

          <div>
            <label className="input-label">Equipamento (Inventário)</label>
            <select value={form.inventoryItemId} onChange={f('inventoryItemId')} className="input">
              <option value="">Nenhum</option>
              {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Descrição</label>
            <textarea value={form.description} onChange={f('description')} rows={2} className="input" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!connectTarget} onClose={() => setConnectTarget(null)} title={`Console — ${connectTarget?.name ?? ''}`} size="xl">
        <div style={{ height: '65vh', margin: -20 }}>
          {connectTarget && <SshTerminal hostId={connectTarget.id} hostName={connectTarget.name} onClose={() => setConnectTarget(null)} />}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Excluir Máquina" message={`Excluir a máquina "${deleteTarget?.name}"? As credenciais salvas serão apagadas.`} />
    </Layout>
  )
}

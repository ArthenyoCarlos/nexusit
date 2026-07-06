import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getMonitors, createMonitor, updateMonitor, deleteMonitor, checkNow } from '../services/urlmonitor'

const EMPTY = { name: '', url: '', enabled: true, intervalSec: 300 }

export default function UrlMonitorPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [monitors, setMonitors] = useState([])
  const [loading, setLoading]   = useState(true)
  const [checking, setChecking] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setMonitors(await getMonitors()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit   = (m) => { setEditing(m); setForm({ name: m.name, url: m.url, enabled: m.enabled, intervalSec: m.intervalSec }); setModalOpen(true) }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) await updateMonitor(editing.id, form)
      else await createMonitor(form)
      setModalOpen(false); load()
    } finally { setSaving(false) }
  }

  const handleCheck = async (id) => {
    setChecking(c => ({ ...c, [id]: true }))
    try { const updated = await checkNow(id); setMonitors(ms => ms.map(m => m.id === id ? updated : m)) }
    finally { setChecking(c => { const n = {...c}; delete n[id]; return n }) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteMonitor(deleteTarget.id); setDeleteTarget(null); load() } finally { setDeleting(false) }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const up = monitors.filter(m => m.up).length
  const down = monitors.filter(m => !m.up && m.lastCheck).length

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Monitoramento de URLs</h1>
            <p>{up} online · {down} offline · {monitors.length} monitorados</p>
          </div>
          {isAdmin && <button onClick={openCreate} className="btn btn-primary">+ Adicionar URL</button>}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />)}
          </div>
        ) : monitors.length === 0 ? (
          <div className="card empty-state"><h3>Nenhuma URL monitorada</h3>{isAdmin && <p>Clique em "Adicionar URL" para começar.</p>}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {monitors.map(m => {
              const hasCheck = m.lastCheck != null
              const isUp = m.up && hasCheck
              const isDown = !m.up && hasCheck
              return (
                <div key={m.id} className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: !hasCheck ? 'var(--text-tertiary)' : isUp ? 'var(--green)' : 'var(--red)', animation: isDown ? 'pulse 2s infinite' : 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{m.name}</p>
                      {!m.enabled && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'var(--bg-muted)', color: 'var(--text-tertiary)' }}>PAUSADO</span>}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }} className="truncate">{m.url}</p>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                      {hasCheck && <span style={{ fontSize: 11, color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{isUp ? 'UP' : 'DOWN'} {m.lastStatus ? `(${m.lastStatus})` : ''}</span>}
                      {m.uptimePct != null && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Uptime: {m.uptimePct}%</span>}
                      {m.lastCheck && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Última: {new Date(m.lastCheck).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => handleCheck(m.id)} disabled={checking[m.id]} className="btn btn-default btn-sm">{checking[m.id] ? '...' : 'Verificar'}</button>
                    {isAdmin && <><button onClick={() => openEdit(m)} className="btn btn-default btn-sm">Editar</button><button onClick={() => setDeleteTarget(m)} className="btn btn-danger btn-sm">✕</button></>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Monitor' : 'Adicionar URL'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label className="input-label">Nome *</label><input required value={form.name} onChange={f('name')} className="input" placeholder="ERP Interno" /></div>
          <div><label className="input-label">URL *</label><input required value={form.url} onChange={f('url')} className="input" placeholder="https://erp.local" /></div>
          <div><label className="input-label">Intervalo (segundos)</label><input type="number" min="60" value={form.intervalSec} onChange={f('intervalSec')} className="input" /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="enabled" checked={form.enabled} onChange={f('enabled')} />
            <label htmlFor="enabled" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Monitoramento ativo</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Remover Monitor" message={`Remover monitoramento de "${deleteTarget?.name}"?`} />
    </Layout>
  )
}

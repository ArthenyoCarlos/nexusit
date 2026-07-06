import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getLicenses, createLicense, updateLicense, deleteLicense } from '../services/licenses'
import { downloadWeeklyReport } from '../services/reports'

const EMPTY = { name: '', vendor: '', product: '', licenseKey: '', seatsTotal: '', seatsUsed: '', purchaseDate: '', expiryDate: '', value: '', notes: '' }

const STATUS_CONFIG = {
  EXPIRED:       { label: 'Vencida',          bg: 'var(--red-bg)',    color: 'var(--red)'    },
  EXPIRING_SOON: { label: 'Vence em breve',   bg: 'var(--orange-bg)', color: 'var(--orange)' },
  EXPIRING:      { label: 'Vencendo',         bg: 'var(--amber-bg)',  color: 'var(--amber)'  },
  OK:            { label: 'Válida',           bg: 'var(--green-bg)',  color: 'var(--green)'  },
}

export default function LicensesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setLicenses(await getLicenses()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormError(''); setModalOpen(true) }
  const openEdit   = (l) => {
    setEditing(l)
    setForm({ name: l.name, vendor: l.vendor ?? '', product: l.product ?? '', licenseKey: '', seatsTotal: l.seatsTotal ?? '', seatsUsed: l.seatsUsed ?? 0, purchaseDate: l.purchaseDate ?? '', expiryDate: l.expiryDate ?? '', value: l.value ?? '', notes: l.notes ?? '' })
    setFormError(''); setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('')
    try {
      const payload = { ...form, seatsTotal: form.seatsTotal !== '' ? Number(form.seatsTotal) : null, seatsUsed: Number(form.seatsUsed) || 0, value: form.value !== '' ? Number(form.value) : null, purchaseDate: form.purchaseDate || null, expiryDate: form.expiryDate || null, licenseKey: form.licenseKey || null }
      if (editing) await updateLicense(editing.id, payload)
      else await createLicense(payload)
      setModalOpen(false); load()
    } catch (err) { setFormError(err.response?.data?.detail ?? 'Erro ao salvar.') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteLicense(deleteTarget.id); setDeleteTarget(null); load() } finally { setDeleting(false) }
  }

  const handleReport = async () => {
    setReportLoading(true)
    try {
      const blob = await downloadWeeklyReport()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } finally { setReportLoading(false) }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const expiring = licenses.filter(l => l.status === 'EXPIRING_SOON' || l.status === 'EXPIRED')

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Controle de Licenças</h1>
            <p>{licenses.length} licença(s) cadastrada(s)</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdmin && <button onClick={handleReport} disabled={reportLoading} className="btn btn-default">{reportLoading ? 'Gerando...' : 'Relatório Semanal PDF'}</button>}
            {isAdmin && <button onClick={openCreate} className="btn btn-primary">+ Nova Licença</button>}
          </div>
        </div>

        {expiring.length > 0 && (
          <div className="alert alert-amber" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <p style={{ fontWeight: 600, fontSize: 13 }}>{expiring.length} licença(s) vencida(s) ou a vencer em breve</p>
            <p style={{ fontSize: 12 }}>{expiring.map(l => l.name).join(', ')}</p>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />)}
          </div>
        ) : licenses.length === 0 ? (
          <div className="card empty-state">
            <h3>Nenhuma licença cadastrada</h3>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>{['Status', 'Nome', 'Fornecedor', 'Produto', 'Assentos', 'Vencimento', 'Valor', ''].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {licenses.map(l => {
                    const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG.OK
                    const seats = l.seatsTotal != null ? `${l.seatsUsed}/${l.seatsTotal}` : `${l.seatsUsed} usados`
                    return (
                      <tr key={l.id}>
                        <td><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>{sc.label}</span></td>
                        <td style={{ fontWeight: 500 }}>{l.name}</td>
                        <td className="muted">{l.vendor || '—'}</td>
                        <td className="muted">{l.product || '—'}</td>
                        <td className="muted">{seats}</td>
                        <td className="muted">{l.expiryDate ? new Date(l.expiryDate + 'T00:00').toLocaleDateString('pt-BR') : '—'}{l.daysUntilExpiry >= 0 && l.daysUntilExpiry !== -1 && l.status !== 'OK' ? <span style={{ color: sc.color, marginLeft: 6, fontSize: 11 }}>({l.daysUntilExpiry}d)</span> : null}</td>
                        <td className="muted">{l.value != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(l.value) : '—'}</td>
                        <td>{isAdmin && <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}><button onClick={() => openEdit(l)} className="btn btn-default btn-sm">Editar</button><button onClick={() => setDeleteTarget(l)} className="btn btn-danger btn-sm">Excluir</button></div>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Licença' : 'Nova Licença'} size="lg">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div style={{ gridColumn: 'span 2' }}><label className="input-label">Nome *</label><input required value={form.name} onChange={f('name')} className="input" placeholder="Ex: Microsoft 365 Business" /></div>
            <div><label className="input-label">Fornecedor</label><input value={form.vendor} onChange={f('vendor')} className="input" placeholder="Microsoft" /></div>
            <div><label className="input-label">Produto</label><input value={form.product} onChange={f('product')} className="input" placeholder="Office 365" /></div>
            <div><label className="input-label">Assentos Total</label><input type="number" value={form.seatsTotal} onChange={f('seatsTotal')} className="input" /></div>
            <div><label className="input-label">Assentos Em Uso</label><input type="number" value={form.seatsUsed} onChange={f('seatsUsed')} className="input" /></div>
            <div><label className="input-label">Data de Compra</label><input type="date" value={form.purchaseDate} onChange={f('purchaseDate')} className="input" /></div>
            <div><label className="input-label">Vencimento</label><input type="date" value={form.expiryDate} onChange={f('expiryDate')} className="input" /></div>
            <div><label className="input-label">Valor (R$)</label><input type="number" step="0.01" value={form.value} onChange={f('value')} className="input" /></div>
            <div><label className="input-label">Chave de Licença</label><input value={form.licenseKey} onChange={f('licenseKey')} className="input" style={{ fontFamily: 'var(--font-mono)' }} placeholder="XXXXX-XXXXX-XXXXX" /></div>
            <div style={{ gridColumn: 'span 2' }}><label className="input-label">Observações</label><textarea value={form.notes} onChange={f('notes')} rows={2} className="input" /></div>
          </div>
          {formError && <div className="alert alert-red"><p>{formError}</p></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} title="Excluir Licença" message={`Excluir "${deleteTarget?.name}"?`} />
    </Layout>
  )
}

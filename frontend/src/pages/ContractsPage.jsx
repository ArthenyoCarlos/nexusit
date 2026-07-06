import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getContracts, createContract, updateContract, deleteContract } from '../services/contracts'

const TYPES = ['MENSAL', 'ANUAL', 'UNICO']
const EMPTY = { name: '', vendor: '', contactName: '', contactEmail: '', contactPhone: '', type: 'ANUAL', value: '', startDate: '', endDate: '', autoRenew: false, notes: '' }

const STATUS_CFG = {
  EXPIRED:       { label: 'Vencido',        color: 'var(--red)',    bg: 'var(--red-bg)'    },
  EXPIRING_SOON: { label: 'Vence em breve', color: 'var(--orange)', bg: 'var(--orange-bg)' },
  EXPIRING:      { label: 'A vencer',       color: 'var(--amber)',  bg: 'var(--amber-bg)'  },
  OK:            { label: 'Vigente',        color: 'var(--green)',  bg: 'var(--green-bg)'  },
}

const BRL = v => v != null ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) : '—'
const DATE = v => v ? new Date(v+'T00:00').toLocaleDateString('pt-BR') : '—'

export default function ContractsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [contracts, setContracts] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [confirm, setConfirm]     = useState(null)

  const load = () => getContracts().then(setContracts).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true) }
  const openEdit   = c  => { setForm({ ...c, value: c.value ?? '', startDate: c.startDate ?? '', endDate: c.endDate ?? '' }); setEditing(c.id); setModal(true) }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    try {
      const payload = { ...form, value: form.value ? Number(form.value) : null, startDate: form.startDate || null, endDate: form.endDate || null }
      if (editing) await updateContract(editing, payload)
      else         await createContract(payload)
      setModal(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async id => { await deleteContract(id); load() }

  const expiring = contracts.filter(c => c.status === 'EXPIRED' || c.status === 'EXPIRING_SOON')

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Contratos de Fornecedores</h1>
            <p>{contracts.length} contrato(s) cadastrado(s)</p>
          </div>
          {isAdmin && <button onClick={openCreate} className="btn btn-primary">+ Novo Contrato</button>}
        </div>

        {expiring.length > 0 && (
          <div className="alert alert-amber" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <p style={{ fontWeight: 600, fontSize: 13 }}>{expiring.length} contrato(s) vencido(s) ou a vencer em breve</p>
            <p style={{ fontSize: 12.5 }}>{expiring.map(c => c.name).join(', ')}</p>
          </div>
        )}

        <div className="card scroll-x" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {['Status','Nome','Fornecedor','Tipo','Valor','Vigência','Contato',''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => {
                const s = STATUS_CFG[c.status] ?? STATUS_CFG.OK
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: s.bg, color: s.color }}>
                        {s.label}{c.daysUntilExpiry >= 0 && c.status !== 'OK' ? ` (${c.daysUntilExpiry}d)` : ''}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</p>
                      {c.autoRenew && <p style={{ fontSize: 11, color: 'var(--green)' }}>Renovação automática</p>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{c.vendor ?? '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{c.type}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{BRL(c.value)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>{DATE(c.startDate)} → {DATE(c.endDate)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                      {c.contactName && <p>{c.contactName}</p>}
                      {c.contactEmail && <p>{c.contactEmail}</p>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(c)} className="btn btn-default btn-sm">Editar</button>
                          <button onClick={() => setConfirm(c.id)} className="btn btn-danger btn-sm">Excluir</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!loading && contracts.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nenhum contrato cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Contrato' : 'Novo Contrato'} size="lg">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Nome *</label>
                <input required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Fornecedor</label>
                <input value={form.vendor} onChange={e => setForm(f=>({...f,vendor:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Tipo</label>
                <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))} className="input">
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Renovação automática</label>
                <select value={form.autoRenew} onChange={e => setForm(f=>({...f,autoRenew:e.target.value==='true'}))} className="input">
                  <option value="false">Não</option>
                  <option value="true">Sim</option>
                </select>
              </div>
              <div>
                <label className="input-label">Valor (R$)</label>
                <input type="number" step="0.01" value={form.value} onChange={e => setForm(f=>({...f,value:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Início</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f=>({...f,startDate:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Vencimento</label>
                <input type="date" value={form.endDate} onChange={e => setForm(f=>({...f,endDate:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Contato</label>
                <input value={form.contactName} onChange={e => setForm(f=>({...f,contactName:e.target.value}))} className="input" placeholder="Nome" />
              </div>
              <div>
                <label className="input-label">E-mail contato</label>
                <input type="email" value={form.contactEmail} onChange={e => setForm(f=>({...f,contactEmail:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Telefone contato</label>
                <input value={form.contactPhone} onChange={e => setForm(f=>({...f,contactPhone:e.target.value}))} className="input" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Observações</label>
                <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} className="input" rows={2} style={{ resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setModal(false)} className="btn btn-default">Cancelar</button>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog open={!!confirm} title="Excluir contrato?" message="Esta ação não pode ser desfeita."
          onConfirm={() => { handleDelete(confirm); setConfirm(null) }} onCancel={() => setConfirm(null)} />
      </div>
    </Layout>
  )
}

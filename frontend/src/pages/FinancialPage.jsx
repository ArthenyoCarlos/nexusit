import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getFinancialSummary, getBills, createBill, updateBill, payBill, deleteBill } from '../services/financial'

const CATEGORIES = ['Licença', 'Contrato', 'Hardware', 'Serviço', 'Internet', 'Suporte', 'Outros']
const EMPTY = { title: '', vendor: '', category: 'Outros', amount: '', dueDate: '', notes: '' }

const BRL = v => v != null ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) : 'R$ 0,00'
const DATE = v => v ? new Date(v+'T00:00').toLocaleDateString('pt-BR') : '—'

const STATUS_CFG = {
  OVERDUE:  { label: 'Vencida',    color: '#dc2626', bg: '#fef2f2' },
  DUE_SOON: { label: 'Vence hoje/amanhã', color: '#ea580c', bg: '#fff7ed' },
  UPCOMING: { label: 'Esta semana', color: '#d97706', bg: '#fffbeb' },
  OK:       { label: 'Em dia',     color: '#0e9f6e', bg: '#f0fdf4' },
  PAID:     { label: 'Pago',       color: '#64748b', bg: '#f8fafc' },
}

export default function FinancialPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [summary, setSummary] = useState({})
  const [bills, setBills]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [filter, setFilter]   = useState('pending') // pending | all | paid

  const load = () => Promise.all([getFinancialSummary(), getBills()])
    .then(([s, b]) => { setSummary(s); setBills(b) })
    .finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(EMPTY); setEditing(null); setModal(true) }
  const openEdit   = b => { setForm({ title: b.title, vendor: b.vendor ?? '', category: b.category ?? 'Outros', amount: b.amount, dueDate: b.dueDate, notes: b.notes ?? '' }); setEditing(b.id); setModal(true) }

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    try {
      const p = { ...form, amount: Number(form.amount) }
      if (editing) await updateBill(editing, p)
      else         await createBill(p)
      setModal(false); load()
    } finally { setSaving(false) }
  }

  const handlePay = async id => { await payBill(id); load() }
  const handleDelete = async id => { await deleteBill(id); load() }

  const filtered = bills.filter(b =>
    filter === 'all' ? true : filter === 'paid' ? b.paid : !b.paid
  )
  const overdueBills = bills.filter(b => !b.paid && b.status === 'OVERDUE')
  const dueSoonBills = bills.filter(b => !b.paid && (b.status === 'DUE_SOON' || b.status === 'UPCOMING'))

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Financeiro de TI</h1>
            <p>Visão geral de custos e contas a pagar</p>
          </div>
          {isAdmin && <button onClick={openCreate} className="btn btn-primary">+ Nova Conta</button>}
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total em Ativos',    value: BRL(summary.totalAssets),    color: '#1a56db', bg: 'var(--accent-light)', icon: '🖥️' },
            { label: 'Total em Licenças',  value: BRL(summary.totalLicenses),  color: '#7c3aed', bg: 'var(--purple-bg)',    icon: '📋' },
            { label: 'Total em Contratos', value: BRL(summary.totalContracts), color: '#0891b2', bg: 'var(--cyan-bg,#ecfeff)', icon: '📄' },
            { label: 'Contas a Pagar',     value: BRL(summary.pendingBills),   color: summary.overdueBills > 0 ? '#e02424' : '#d97706', bg: summary.overdueBills > 0 ? 'var(--red-bg)' : 'var(--amber-bg)', icon: '💳' },
          ].map(k => (
            <div key={k.label} className="stat-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div className="stat-icon" style={{ background: k.bg, color: k.color, fontSize: 20 }}>{k.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{k.value}</div>
                <div className="stat-label">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Alertas */}
        {overdueBills.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
            <p style={{ fontWeight: 600, color: '#991b1b', fontSize: 13 }}>🔴 {overdueBills.length} conta(s) vencida(s): {overdueBills.map(b => b.title).join(', ')}</p>
          </div>
        )}
        {dueSoonBills.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
            <p style={{ fontWeight: 600, color: '#92400e', fontSize: 13 }}>⚠ {dueSoonBills.length} conta(s) vencendo em breve</p>
          </div>
        )}

        {/* Filtros + Tabela */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-muted)' }}>
            {[['pending','Pendentes'],['upcoming','A vencer'],['all','Todas'],['paid','Pagas']].map(([v,l]) => (
              <button key={v} onClick={() => setFilter(v)} className={`btn btn-sm ${filter===v?'btn-primary':'btn-default'}`}>{l}</button>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {['Status','Descrição','Fornecedor','Categoria','Valor','Vencimento',''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(filter === 'upcoming'
                ? bills.filter(b => !b.paid && (b.status === 'UPCOMING' || b.status === 'DUE_SOON' || b.status === 'OK'))
                : filtered
              ).map(b => {
                const s = STATUS_CFG[b.status] ?? STATUS_CFG.OK
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border-muted)', opacity: b.paid ? 0.6 : 1 }}>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{b.title}</p>
                      {b.notes && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{b.notes}</p>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{b.vendor ?? '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{b.category}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13.5, fontWeight: 700, color: b.paid ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{BRL(b.amount)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: b.status === 'OVERDUE' ? '#dc2626' : 'var(--text-secondary)' }}>
                      {DATE(b.dueDate)}
                      {b.paid && b.paidAt && <p style={{ fontSize: 11, color: '#0e9f6e' }}>Pago em {DATE(b.paidAt)}</p>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!b.paid && <button onClick={() => handlePay(b.id)} className="btn btn-primary btn-sm">✓ Pagar</button>}
                          <button onClick={() => openEdit(b)} className="btn btn-default btn-sm">Editar</button>
                          <button onClick={() => setConfirm(b.id)} className="btn btn-danger btn-sm">✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nenhuma conta encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Conta' : 'Nova Conta a Pagar'}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="input-label">Descrição *</label>
                <input required value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} className="input" placeholder="Ex: Renovação licença Office" />
              </div>
              <div>
                <label className="input-label">Fornecedor</label>
                <input value={form.vendor} onChange={e => setForm(f=>({...f,vendor:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Categoria</label>
                <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))} className="input">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Valor (R$) *</label>
                <input required type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Vencimento *</label>
                <input required type="date" value={form.dueDate} onChange={e => setForm(f=>({...f,dueDate:e.target.value}))} className="input" />
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

        <ConfirmDialog open={!!confirm} title="Excluir conta?" message="Esta ação não pode ser desfeita."
          onConfirm={() => { handleDelete(confirm); setConfirm(null) }} onCancel={() => setConfirm(null)} />
      </div>
    </Layout>
  )
}

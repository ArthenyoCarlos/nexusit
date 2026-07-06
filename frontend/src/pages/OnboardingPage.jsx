import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { getChecklists, createChecklist, toggleItem, deleteChecklist } from '../services/onboarding'

const ONBOARDING_ITEMS = [
  'Criar conta de e-mail corporativo', 'Configurar VPN de acesso', 'Entregar notebook/computador',
  'Instalar softwares necessários', 'Conceder acesso ao sistema ERP', 'Configurar ramal telefônico',
  'Adicionar ao grupo de e-mail da equipe', 'Cadastrar no sistema de ponto',
]
const OFFBOARDING_ITEMS = [
  'Revogar acesso ao e-mail corporativo', 'Remover acesso à VPN', 'Recolher notebook/computador',
  'Recolher crachá e equipamentos', 'Revogar acesso ao sistema ERP', 'Fazer backup dos dados do usuário',
  'Transferir arquivos e responsabilidades', 'Cancelar ramal telefônico',
]

const EMPTY_FORM = { type: 'ONBOARDING', employeeName: '', department: '', startDate: '', notes: '' }

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [lists, setLists]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setLists(await getChecklists(filter ? { type: filter } : {})) } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const defaultItems = form.type === 'ONBOARDING' ? ONBOARDING_ITEMS : OFFBOARDING_ITEMS
      await createChecklist({ ...form, startDate: form.startDate || null, items: defaultItems.map((t, i) => ({ title: t, itemOrder: i })) })
      setModalOpen(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await deleteChecklist(deleteTarget.id); setDeleteTarget(null); load() } finally { setDeleting(false) }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const pct = (l) => l.totalItems === 0 ? 0 : Math.round((l.doneItems / l.totalItems) * 100)

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Onboarding / Offboarding</h1>
            <p>Checklists de entrada e saída de funcionários</p>
          </div>
          <button onClick={() => { setForm(EMPTY_FORM); setModalOpen(true) }} className="btn btn-primary">+ Novo Checklist</button>
        </div>

        <div className="filter-bar">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="OFFBOARDING">Offboarding</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10 }} />)}
          </div>
        ) : lists.length === 0 ? (
          <div className="card empty-state"><h3>Nenhum checklist encontrado</h3></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lists.map(l => {
              const p = pct(l)
              const isOn = l.type === 'ONBOARDING'
              return (
                <div key={l.id} className="card card-hover" style={{ padding: '18px 22px', cursor: 'pointer' }} onClick={() => navigate(`/onboarding/${l.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: isOn ? 'var(--accent-light)' : 'var(--purple-bg)', color: isOn ? 'var(--accent-text)' : 'var(--purple)' }}>
                          {isOn ? '👋 ONBOARDING' : '🚪 OFFBOARDING'}
                        </span>
                        {l.department && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{l.department}</span>}
                      </div>
                      <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{l.employeeName}</p>
                      {l.startDate && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{new Date(l.startDate + 'T00:00').toLocaleDateString('pt-BR')}</p>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 22, fontWeight: 700, color: p === 100 ? 'var(--success)' : 'var(--accent)' }}>{p}%</p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{l.doneItems}/{l.totalItems} tarefas</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, height: 6, background: 'var(--border-muted)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: p + '%', background: p === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDeleteTarget(l)} className="btn btn-danger btn-sm">Excluir</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Checklist">
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">Tipo *</label>
            <select value={form.type} onChange={f('type')} className="input">
              <option value="ONBOARDING">Onboarding (entrada)</option>
              <option value="OFFBOARDING">Offboarding (saída)</option>
            </select>
          </div>
          <div>
            <label className="input-label">Nome do Funcionário *</label>
            <input required value={form.employeeName} onChange={f('employeeName')} className="input" placeholder="Ex: João Silva" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div>
              <label className="input-label">Setor</label>
              <input value={form.department} onChange={f('department')} className="input" placeholder="Financeiro" />
            </div>
            <div>
              <label className="input-label">Data de Início</label>
              <input type="date" value={form.startDate} onChange={f('startDate')} className="input" />
            </div>
          </div>
          <div>
            <label className="input-label">Observações</label>
            <textarea value={form.notes} onChange={f('notes')} rows={2} className="input" />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Um checklist padrão de {form.type === 'ONBOARDING' ? ONBOARDING_ITEMS.length : OFFBOARDING_ITEMS.length} tarefas será gerado automaticamente.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Criando...' : 'Criar Checklist'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Excluir Checklist" message={`Excluir checklist de "${deleteTarget?.employeeName}"?`} />
    </Layout>
  )
}

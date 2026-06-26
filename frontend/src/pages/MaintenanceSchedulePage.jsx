import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'
import { getSchedules, createSchedule, completeSchedule, deleteSchedule } from '../services/mschedule'
import { getUsers } from '../services/users'

const RECURRENCES = [
  { value: 'DAILY', label: 'Diária' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'YEARLY', label: 'Anual' },
]

const STATUS_CFG = {
  OVERDUE: { label: 'Atrasada', color: '#dc2626', bg: '#fef2f2' },
  TODAY:   { label: 'Hoje',     color: '#ea580c', bg: '#fff7ed' },
  SOON:    { label: 'Em breve', color: '#d97706', bg: '#fffbeb' },
  OK:      { label: 'OK',       color: '#0e9f6e', bg: '#f0fdf4' },
}

const EMPTY = { title: '', description: '', recurrence: 'MONTHLY', nextDue: '', assignedToId: '' }

export default function MaintenanceSchedulePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [schedules, setSchedules] = useState([])
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [completing, setCompleting] = useState(null)
  const [completeNotes, setCompleteNotes] = useState('')
  const [confirm, setConfirm]     = useState(null)

  const load = () => getSchedules().then(setSchedules).finally(() => setLoading(false))
  useEffect(() => { load(); getUsers().then(setUsers) }, [])

  const handleSave = async e => {
    e.preventDefault(); setSaving(true)
    try { await createSchedule({ ...form, nextDue: form.nextDue || null, assignedToId: form.assignedToId || null }); setModal(false); load() }
    finally { setSaving(false) }
  }

  const handleComplete = async () => {
    await completeSchedule(completing, completeNotes)
    setCompleting(null); setCompleteNotes(''); load()
  }

  const overdue = schedules.filter(s => s.dueSatus === 'OVERDUE')
  const today   = schedules.filter(s => s.dueSatus === 'TODAY')

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Agenda de Manutenção</h1>
            <p>{schedules.length} tarefa(s) ativa(s)</p>
          </div>
          {isAdmin && <button onClick={() => { setForm(EMPTY); setModal(true) }} className="btn btn-primary">+ Nova Tarefa</button>}
        </div>

        {(overdue.length > 0 || today.length > 0) && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <p style={{ fontWeight: 600, color: '#991b1b', fontSize: 13 }}>
              🔴 {overdue.length} tarefa(s) atrasada(s){today.length > 0 ? ` · ${today.length} para hoje` : ''}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {schedules.map(s => {
            const st = STATUS_CFG[s.dueSatus] ?? STATUS_CFG.OK
            return (
              <div key={s.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 20 }}>{s.dueSatus === 'OVERDUE' ? '🔴' : s.dueSatus === 'TODAY' ? '🟡' : s.dueSatus === 'SOON' ? '🟠' : '✅'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color }}>{st.label}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                      {RECURRENCES.find(r => r.value === s.recurrence)?.label ?? s.recurrence}
                    </span>
                  </div>
                  {s.description && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 3 }}>{s.description}</p>}
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <p style={{ fontSize: 12, color: st.color, fontWeight: 600 }}>
                      Próxima: {s.nextDue ? new Date(s.nextDue+'T00:00').toLocaleDateString('pt-BR') : '—'}
                      {s.daysUntilDue < 0 ? ` (${Math.abs(s.daysUntilDue)}d atraso)` : s.daysUntilDue === 0 ? ' (hoje)' : ` (em ${s.daysUntilDue}d)`}
                    </p>
                    {s.assignedToName && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Responsável: {s.assignedToName}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setCompleting(s.id); setCompleteNotes('') }} className="btn btn-primary btn-sm">✓ Concluir</button>
                  {isAdmin && <button onClick={() => setConfirm(s.id)} className="btn btn-danger btn-sm">✕</button>}
                </div>
              </div>
            )
          })}
          {!loading && schedules.length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nenhuma tarefa de manutenção cadastrada.</p>
            </div>
          )}
        </div>

        <Modal open={modal} onClose={() => setModal(false)} title="Nova Tarefa de Manutenção">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="input-label">Título *</label>
              <input required value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} className="input" placeholder="Ex: Trocar fita de backup" />
            </div>
            <div>
              <label className="input-label">Descrição</label>
              <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} className="input" rows={2} style={{ resize: 'none' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="input-label">Recorrência</label>
                <select value={form.recurrence} onChange={e => setForm(f=>({...f,recurrence:e.target.value}))} className="input">
                  {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Próxima data *</label>
                <input required type="date" value={form.nextDue} onChange={e => setForm(f=>({...f,nextDue:e.target.value}))} className="input" />
              </div>
              <div>
                <label className="input-label">Responsável</label>
                <select value={form.assignedToId} onChange={e => setForm(f=>({...f,assignedToId:e.target.value}))} className="input">
                  <option value="">Não atribuído</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setModal(false)} className="btn btn-default">Cancelar</button>
              <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>

        <Modal open={!!completing} onClose={() => setCompleting(null)} title="Registrar conclusão">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="input-label">Observações (opcional)</label>
              <textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} className="input" rows={3} style={{ resize: 'none' }} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>A próxima data será calculada automaticamente com base na recorrência.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setCompleting(null)} className="btn btn-default">Cancelar</button>
              <button onClick={handleComplete} className="btn btn-primary">✓ Confirmar conclusão</button>
            </div>
          </div>
        </Modal>

        <ConfirmDialog open={!!confirm} title="Remover tarefa?" message="A tarefa será marcada como inativa."
          onConfirm={() => { deleteSchedule(confirm); setConfirm(null); load() }} onCancel={() => setConfirm(null)} />
      </div>
    </Layout>
  )
}

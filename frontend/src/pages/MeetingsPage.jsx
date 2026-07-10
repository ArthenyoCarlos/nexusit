import { useState, useEffect, useCallback } from 'react'
import { getMeetings, createMeeting, updateMeeting, deleteMeeting } from '../services/meetings'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'

const TYPE_LABELS = {
  EQUIPE: 'Equipe',
  FORNECEDOR: 'Fornecedor',
  APRESENTACAO_PRODUTO: 'Apresentação de Produto',
  OUTRO: 'Outro',
}
const TYPE_BADGE = {
  EQUIPE: 'badge-blue',
  FORNECEDOR: 'badge-amber',
  APRESENTACAO_PRODUTO: 'badge-green',
  OUTRO: 'badge-gray',
}

const EMPTY_FORM = {
  title: '', type: 'EQUIPE', companyName: '', meetingDate: new Date().toISOString().slice(0, 10),
  participants: '', summary: '', nextSteps: '',
}

export default function MeetingsPage() {
  const { user } = useAuth()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState(null) // null = create
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMeetings()
      setMeetings(res.data)
    } catch { setMeetings([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openCreate() {
    setEditingMeeting(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(meeting) {
    setEditingMeeting(meeting)
    setForm({
      title: meeting.title,
      type: meeting.type,
      companyName: meeting.companyName || '',
      meetingDate: meeting.meetingDate,
      participants: meeting.participants || '',
      summary: meeting.summary || '',
      nextSteps: meeting.nextSteps || '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.meetingDate) return
    setSaving(true)
    try {
      if (editingMeeting) {
        await updateMeeting(editingMeeting.id, form)
      } else {
        await createMeeting(form)
      }
      setModalOpen(false)
      fetch()
    } catch { /* error handled silently */ }
    finally { setSaving(false) }
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!window.confirm('Excluir esta reunião?')) return
    await deleteMeeting(id)
    fetch()
  }

  const filtered = meetings.filter(m => {
    if (typeFilter && m.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const haystack = `${m.title} ${m.companyName || ''} ${m.participants || ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  return (
    <Layout>
      <div className="page fade-up">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Reuniões</h1>
            <p>{meetings.length} reunião(ões) registrada(s)</p>
          </div>
          <button onClick={openCreate} className="btn btn-primary">+ Nova Reunião</button>
        </div>

        <div className="filter-bar">
          <input type="text" placeholder="Buscar título, empresa ou participante..." value={search}
            onChange={e => setSearch(e.target.value)} className="input" style={{ width: 260, height: 32 }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input" style={{ width: 'auto', height: 32 }}>
            <option value="">Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--r-lg)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>
            </div>
            <h3>Nenhuma reunião encontrada</h3>
            <p>Registre a primeira reunião para começar</p>
            <button onClick={openCreate} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>+ Nova Reunião</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
            {filtered.map(meeting => (
              <div key={meeting.id} onClick={() => openEdit(meeting)} className="card note-card"
                style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = '' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{meeting.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span className={`badge ${TYPE_BADGE[meeting.type] || 'badge-gray'}`} style={{ fontSize: 11 }}>
                      {TYPE_LABELS[meeting.type] || meeting.type}
                    </span>
                    {(meeting.createdById === user?.id || user?.role === 'ADMIN') && (
                      <button onClick={(e) => handleDelete(meeting.id, e)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {meeting.companyName && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>{meeting.companyName}</p>
                )}

                {meeting.summary && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {meeting.summary}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-muted)' }}>
                  <span>{meeting.createdByName}</span>
                  <span>{new Date(meeting.meetingDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingMeeting ? 'Editar Reunião' : 'Nova Reunião'} size="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="text" placeholder="Título *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input" style={{ flex: 1 }} />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input" style={{ width: 220 }}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <input type="text" placeholder="Empresa / Fornecedor (ex: 2com)" value={form.companyName}
              onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              className="input" style={{ flex: 1 }} />
            <input type="date" value={form.meetingDate}
              onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))}
              className="input" style={{ width: 180 }} />
          </div>

          <input type="text" placeholder="Participantes (separados por vírgula)" value={form.participants}
            onChange={e => setForm(f => ({ ...f, participants: e.target.value }))}
            className="input" />

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Resumo</label>
            <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              placeholder="O que foi discutido na reunião..." rows={5}
              className="input" style={{ fontSize: 13, resize: 'vertical', height: 'auto' }} />
          </div>

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Próximos passos</label>
            <textarea value={form.nextSteps} onChange={e => setForm(f => ({ ...f, nextSteps: e.target.value }))}
              placeholder="Ações combinadas, pendências, prazos..." rows={4}
              className="input" style={{ fontSize: 13, resize: 'vertical', height: 'auto' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setModalOpen(false)} className="btn btn-default">Cancelar</button>
            <button onClick={handleSave} disabled={!form.title.trim() || !form.meetingDate || saving} className="btn btn-primary">
              {saving ? 'Salvando...' : editingMeeting ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
